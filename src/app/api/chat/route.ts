// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { detectLanguage } from '@/lib/language-detect';
import { scrubPII } from '@/lib/pii-scrubber';
import { supabase } from '@/lib/supabase';

import { GUIDES_SEED } from '@/lib/seed-data';

// Import shared types
import type { ChatRequest, ChatMessage, Language, Guide } from '@/types/api';

// System prompt for CLARA's LLM
const SYSTEM_PROMPT = `
You are CLARA, a Civil Legal and Registry Assistant in the Philippines.
Your task is to guide the citizen based ONLY on the verified legal guidelines provided below.
Do not guess requirements, fees, or steps. If the information is not in the guide, state that they should consult their Local Civil Registrar (LCRO).
Respond in the same language the user is using (English, Filipino/Tagalog, or Bisaya/Cebuano).
Never claim to be a government official. Never provide legal advice. Always clarify you provide guidance only.
Use a warm, respectful, and encouraging tone. Be concise and clear — many users are first-time filers with low civic literacy.

If a guide is successfully found for the user's inquiry, at the very end of your response, output a special block formatted exactly like this:
[CHECKLIST: Guide Title]
where "Guide Title" is the exact title of the matching guide. This will trigger the application to render the interactive checklist card.
`;

async function fetchGuide(kbId: number, lang: string): Promise<Guide | null> {
  try {
    const { data } = await supabase.from('guides').select('*').eq('kb_id', kbId).eq('language', lang).single();
    if (data) return data as Guide;
    const { data: fil } = await supabase.from('guides').select('*').eq('kb_id', kbId).eq('language', 'fil').single();
    if (fil) return fil as Guide;
  } catch (e) {
    console.warn('fetchGuide from DB failed, checking seed:', e);
  }
  const match = GUIDES_SEED.find((g) => g.kb_id === kbId && g.language === lang)
    || GUIDES_SEED.find((g) => g.kb_id === kbId && g.language === 'fil');
  return (match as Guide) ?? null;
}

// --- RAG retrieval (ADR-001) -------------------------------------------------
const EMBED_MODEL = 'gemini-embedding-001'; // verified live 2026-06-23; pin it
const EMBED_DIM = 768;                       // matches doc_chunks.embedding vector(768)
const RELEVANCE_THRESHOLD = 0.6;             // below this → defer to LCRO (tune on eval set)

interface RetrievedChunk {
  chunk_id: number;
  guide_id: number | null;
  kb_id: number | null;
  chunk_title: string | null;
  verbatim_text: string;
  similarity: number;
}

// Embed the query with Gemini and return the normalized vector as a number[]
// (the shape supabase.rpc passes to a pgvector param), or null if embedding
// fails (caller then degrades to the no-match path).
async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_QUERY',
          outputDimensionality: EMBED_DIM,
        }),
      }
    );
    if (!res.ok) {
      console.error('query embed failed:', res.status, await res.text());
      return null;
    }
    const v: number[] = (await res.json())?.embedding?.values ?? [];
    if (v.length !== EMBED_DIM) {
      console.error('query embed dim mismatch:', v.length);
      return null;
    }
    // MRL-truncated vectors aren't unit length; normalize (corpus was normalized too).
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  } catch (e) {
    console.error('query embed error:', e);
    return null;
  }
}

// Cosine kNN over activated chunks via the match_doc_chunks RPC, with a 'fil'
// language fallback and the relevance gate applied.
async function retrieveChunks(query: string, lang: string, apiKey: string): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query, apiKey);
  if (!embedding) return [];

  const run = async (matchLang: string): Promise<RetrievedChunk[]> => {
    const { data, error } = await supabase.rpc('match_doc_chunks', {
      query_embedding: embedding,
      match_language: matchLang,
      match_count: 5,
    });
    if (error) {
      console.error('match_doc_chunks error:', error.message);
      return [];
    }
    return (data as RetrievedChunk[]) ?? [];
  };

  let rows = (await run(lang)).filter((c) => c.similarity >= RELEVANCE_THRESHOLD);
  if (rows.length === 0 && lang !== 'fil') {
    rows = (await run('fil')).filter((c) => c.similarity >= RELEVANCE_THRESHOLD);
  }
  return rows;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequest;
    const { messages } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const lastUserMessage = messages[messages.length - 1].content;
    const sanitizedQuery = scrubPII(lastUserMessage);

    // 1. Language detection
    const lang = detectLanguage(sanitizedQuery) as Language;

    // 2. Retrieval mode depends on whether the live LLM/embedding API is wired
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const hasLiveAPI = apiKey && apiKey !== 'your_gemini_api_key';

    if (hasLiveAPI) {
      // LIVE MODE: RAG — embed the query, cosine-retrieve activated chunks,
      // ground Gemini on their verbatim text (ADR-001 §6).
      const chunks = await retrieveChunks(sanitizedQuery, lang, apiKey!);

      // If vector search returned 0 chunks (empty corpus, unverified chunks, or DB offline),
      // fall back to matching verified structured guides before declaring "no match".
      let fallbackGuide: Guide | null = null;
      if (chunks.length === 0) {
        const queryLower = sanitizedQuery.toLowerCase();
        if (queryLower.includes('clerical') || queryLower.includes('correct') || queryLower.includes('error') || queryLower.includes('apelyido') || queryLower.includes('avocado') || queryLower.includes('avocardo') || queryLower.includes('9048')) {
          fallbackGuide = await fetchGuide(101, lang);
        } else if (queryLower.includes('late') || queryLower.includes('huli') || queryLower.includes('negative') || queryLower.includes('saksi') || queryLower.includes('witness') || queryLower.includes('rehistro')) {
          fallbackGuide = await fetchGuide(102, lang);
        } else if (queryLower.includes('indigenous') || queryLower.includes('katutubo') || queryLower.includes('lumad') || queryLower.includes('tboli') || queryLower.includes(' chieftan') || queryLower.includes('chieftain') || queryLower.includes('8371') || queryLower.includes('brap')) {
          fallbackGuide = await fetchGuide(103, lang);
        }
      }

      let contextText = '';
      if (chunks.length > 0) {
        contextText = `VERIFIED GUIDELINES (cite ONLY from these; do not invent details):\n\n` +
          chunks
            .map((c, i) => `[Source ${i + 1}: ${c.chunk_title ?? 'Guide'}]\n${c.verbatim_text}`)
            .join('\n\n');
      } else if (fallbackGuide) {
        const steps = (fallbackGuide.steps_json ?? []).map((s) => `${s.step_number}. ${s.instruction}`).join('\n');
        const reqs = (fallbackGuide.requirements_json ?? []).map((r) => `- ${r}`).join('\n');
        contextText = `VERIFIED GUIDELINES (cite ONLY from these; do not invent details):\n\n` +
          `[Source: ${fallbackGuide.title}]\n` +
          `Title: ${fallbackGuide.title}\n` +
          `Steps:\n${steps}\n\n` +
          `Requirements:\n${reqs}\n\n` +
          `Fees: ${fallbackGuide.fees_text}\n\n` +
          `Tip: ${fallbackGuide.tips}`;
      } else {
        contextText = `No verified guideline matched this question. Tell the user, in their language, that you do not have specific verified guidance for this, and that they should consult their Local Civil Registrar (LCRO). Do not invent requirements, fees, or steps.`;
      }

      const promptContext = `
        ${SYSTEM_PROMPT}

        ${contextText}

        User message (PII Sanitized): ${sanitizedQuery}
      `;

      const result = streamText({
        model: google('gemini-2.5-flash'),
        prompt: promptContext,
      });

      // Re-encode Gemini's token stream into the "0:\"text\"" data-stream
      // format the chat client parses (chat/page.tsx) — the same format mock
      // mode emits. We consume fullStream (not textStream) because in ai v6 an
      // upstream failure (bad key, retired model) surfaces as an 'error' part
      // and does NOT throw from textStream; degrade to a grounded fallback
      // message instead of a silent empty stream.
      const encoder = new TextEncoder();
      const FALLBACK =
        'Paumanhin, nagkaroon ng problema sa koneksyon ngayon. Pakisubukan muli, o kumonsulta sa inyong Local Civil Registrar (LCRO).';
      const stream = new ReadableStream({
        async start(controller) {
          let degraded = false;
          try {
            for await (const part of result.fullStream) {
              if (part.type === 'text-delta') {
                const text =
                  (part as any).text ?? (part as any).textDelta ?? (part as any).delta ?? '';
                if (text) controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
              } else if (part.type === 'error') {
                degraded = true;
                console.error('Gemini stream error:', (part as any).error);
                controller.enqueue(encoder.encode(`0:${JSON.stringify(FALLBACK)}\n`));
              }
            }
          } catch (err) {
            console.error('Gemini stream threw:', err);
            if (!degraded) controller.enqueue(encoder.encode(`0:${JSON.stringify(FALLBACK)}\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-vercel-ai-data-stream': 'v1',
        },
      });
    } else {
      // MOCK MODE: no embedding API available — fall back to keyword intent
      // matching against the seeded guides + canned responses.
      let matchedGuide: Guide | null = null;
      const queryLower = sanitizedQuery.toLowerCase();
      if (queryLower.includes('clerical') || queryLower.includes('correct') || queryLower.includes('error') || queryLower.includes('apelyido') || queryLower.includes('avocado') || queryLower.includes('avocardo') || queryLower.includes('9048')) {
        matchedGuide = await fetchGuide(101, lang);
      } else if (queryLower.includes('late') || queryLower.includes('huli') || queryLower.includes('negative') || queryLower.includes('saksi') || queryLower.includes('witness') || queryLower.includes('rehistro')) {
        matchedGuide = await fetchGuide(102, lang);
      } else if (queryLower.includes('indigenous') || queryLower.includes('katutubo') || queryLower.includes('lumad') || queryLower.includes('tboli') || queryLower.includes(' chieftan') || queryLower.includes('chieftain') || queryLower.includes('8371') || queryLower.includes('brap')) {
        matchedGuide = await fetchGuide(103, lang);
      }
      return generateMockResponseStream(lang, matchedGuide, queryLower);
    }
  } catch (e: any) {
    console.error("Chat route error:", e);
    return NextResponse.json({ error: 'Server error processing chat' }, { status: 500 });
  }
}

// Generate streaming mock response to simulate typing speed
function generateMockResponseStream(lang: Language, matchedGuide: Guide | null, queryLower: string) {
  let responseText = "";

  // 1. Language mismatch prompt
  const isUnsupportedLang = queryLower.includes('hola') || queryLower.includes('bonjour') || queryLower.includes('hello from japan');
  if (isUnsupportedLang) {
    if (lang === 'vis') {
      responseText = "Sa pagkakaron, nagsuporta ako sa Ingles, Filipino (Tagalog), ug Bisaya (Cebuano). Palihug pakigsulti kanako sa usa niini nga mga pinulongan.";
    } else if (lang === 'eng') {
      responseText = "I currently support English, Filipino (Tagalog), and Bisaya (Cebuano). Please communicate with me in any of these languages.";
    } else {
      responseText = "Kasalukuyan kong sinusuportahan ang Ingles, Filipino (Tagalog), at Bisaya (Cebuano). Maaari mo akong kausapin sa alinman sa mga wika na ito.";
    }
    return createReadableStreamResponse(responseText);
  }

  // 2. Sharmaine Persona Match (Double Registration Case)
  if (queryLower.includes('dalawa') || queryLower.includes('double') || queryLower.includes('magkaiba ang pangalan') || queryLower.includes('dalandan') || queryLower.includes('sharmaine')) {
    if (lang === 'vis') {
      responseText = "Kumusta, Sharmaine. Pwede natong masulbad kining problema sa double registration. Sa Pilipinas, kung adunay duha ka birth registration ang usa ka tawo, kinahanglan nimo ipa-cancel ang ulahi nga rehistro ug ipabilin ang unang rehistro.\n\n" +
        "Ania ang mga angay buhaton:\n" +
        "1. Kumuha og orihinal nga kopya sa duha ka birth certificate gikan sa PSA.\n" +
        "2. Magpasaka og petisyon sa LCRO diin narehistro ang ulahing birth certificate aron kini ma-cancel pinaagi sa mando sa korte.\n" +
        "3. Kon adunay clerical error sa unang rehistro (magkaibang spelling), mag-file og correction ubos sa RA 9048 sa LCRO diin nahimutangan ang unang rehistro aron magamit kini sa LET board exam.\n\n" +
        "Nag-andam ako og checklist para kanimo sa kilid aron matabangan ka sa pag-proseso niini.\n\n" +
        "[CHECKLIST: Clerical Error Correction (RA 9048)]";
    } else if (lang === 'eng') {
      responseText = "Hello, Sharmaine. We can help you resolve this double registration issue. In the Philippines, if a person has two birth registrations, you generally need to petition to cancel the second registration and retain the first.\n\n" +
        "Here are the steps:\n" +
        "1. Secure original PSA copies of both birth certificates (Manila and CDO).\n" +
        "2. File a petition for cancellation of the second birth registry in the court or coordinate with the LCRO where it was registered.\n" +
        "3. File for correction of clerical errors under RA 9048 for the first birth registration so you can use it for your LET Board Exam.\n\n" +
        "I have generated a checklist on the side to help you prepare the required items.\n\n" +
        "[CHECKLIST: Clerical Error Correction (RA 9048)]";
    } else {
      responseText = "Magandang araw, Sharmaine. Matutulungan ka naming ayusin ang problema sa double birth registration. Alinsunod sa patakaran, kinakailangan mong mag-file ng petition para ipawalang-bisa (cancel) ang pangalawang rehistro at panatilihin ang una.\n\n" +
        "Narito ang mga hakbang:\n" +
        "1. Kumuha ng orihinal na kopya ng dalawang birth certificate mula sa PSA.\n" +
        "2. I-file ang petition for cancellation ng huling rehistro sa LCRO o korte kung saan ito nakarehistro.\n" +
        "3. I-file ang correction para sa clerical error sa unang birth certificate sa ilalim ng RA 9048 para maging tugma ito sa iyong mga school records at magamit sa LET board exam.\n\n" +
        "Nag-handa ako ng checklist para sa iyo sa gilid upang masubaybayan mo ang iyong mga kailangan.\n\n" +
        "[CHECKLIST: Clerical Error Correction (RA 9048)]";
    }
    return createReadableStreamResponse(responseText);
  }

  // 3. Vanessa Persona Match (T'boli Ancestral Domain Case)
  if (queryLower.includes('t\'boli') || queryLower.includes('lolo') || queryLower.includes('lola') || queryLower.includes('isang pangalan') || queryLower.includes('vanessa') || queryLower.includes('singles')) {
    if (lang === 'vis') {
      responseText = "Kumusta, Vanessa. Alang sa imong lolo ug lola nga mga T'boli nga adunay tradisyonal nga singular nga pangalan, aduna kitay gitawag nga Indigenous Peoples Registration ubos sa IPRA RA 8371 ug sa Birth Registration Assistance Project (BRAP).\n\n" +
        "Ania ang mga pamaagi:\n" +
        "1. Pwede silang mogamit og Tribal Chieftain Certificate isip pamatuod sa ilang pagkakakilanlan.\n" +
        "2. Libre ang pagrehistro sa ilalim sa BRAP alang sa mga Indigenous Peoples.\n" +
        "3. I-file kini sa Local Civil Registrar diin sila nagpuyo karon.\n\n" +
        "Gi-generate nako ang checklist sa kilid aron makita nimo ang mga kailanganon alang sa ila.\n\n" +
        "[CHECKLIST: Indigenous Peoples Registration (IPRA RA 8371)]";
    } else if (lang === 'eng') {
      responseText = "Hello, Vanessa. For your T'boli grandparents who use traditional singular names, they can be registered under the Indigenous Peoples Rights Act (IPRA RA 8371) in coordination with the Birth Registration Assistance Project (BRAP).\n\n" +
        "Key aspects:\n" +
        "1. They can present a Tribal Chieftain Certification of Identity instead of standard school records.\n" +
        "2. This late registration is completely free of charge under the BRAP project for IPs.\n" +
        "3. File this at the LCRO where they currently reside.\n\n" +
        "I have generated the interactive checklist on the side for your T'boli grandparents.\n\n" +
        "[CHECKLIST: Indigenous Peoples Registration (IPRA RA 8371)]";
    } else {
      responseText = "Magandang araw, Vanessa. Para sa iyong lolo at lola na T'boli na may tradisyunal na singular name (isang pangalan lang), maaari silang magparehistro sa ilalim ng Indigenous Peoples Registration (IPRA RA 8371) at Birth Registration Assistance Project (BRAP).\n\n" +
        "Narito ang mga detalye:\n" +
        "1. Kumuha ng Tribal Chieftain Certification of Identity bilang patunay ng kanilang pagkakakilanlan.\n" +
        "2. Ang kanilang late registration ay LIBRE sa ilalim ng BRAP para sa mga Indigenous Peoples.\n" +
        "3. I-file ang application sa LCRO na sumasakop sa inyong ancestral domain.\n\n" +
        "Nag-handa ako ng checklist para sa kanila sa gilid upang matulungan kang makumpleto ang kanilang dokumento.\n\n" +
        "[CHECKLIST: Indigenous Peoples Registration (IPRA RA 8371)]";
    }
    return createReadableStreamResponse(responseText);
  }

  // 4. General matched guide responses
  if (matchedGuide) {
    const steps = matchedGuide.steps_json.map((s) => `${s.step_number}. ${s.instruction}`).join('\n');
    const reqs = matchedGuide.requirements_json.map((r) => `- ${r}`).join('\n');

    if (matchedGuide.kb_id === 101) {
      if (lang === 'vis') {
        responseText = `Mahitungod sa Clerical Error Correction (RA 9048), ania ang mga lakang:\n\n${steps}\n\nMga Kinahanglanon:\n${reqs}\n\nBayarin:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Clerical Error Correction (RA 9048)]`;
      } else if (lang === 'eng') {
        responseText = `For Clerical Error Correction (RA 9048), here are the steps:\n\n${steps}\n\nRequirements:\n${reqs}\n\nFees:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Clerical Error Correction (RA 9048)]`;
      } else {
        responseText = `Tungkol sa Clerical Error Correction (RA 9048), narito ang mga hakbang:\n\n${steps}\n\nMga Kailangang Dokumento:\n${reqs}\n\nFiling Fees:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Clerical Error Correction (RA 9048)]`;
      }
    } else if (matchedGuide.kb_id === 102) {
      if (lang === 'vis') {
        responseText = `Mahitungod sa Late Registration of Birth, ania ang mga lakang:\n\n${steps}\n\nMga Kinahanglanon:\n${reqs}\n\nBayarin:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Late Registration of Birth]`;
      } else if (lang === 'eng') {
        responseText = `For Late Registration of Birth, here are the steps:\n\n${steps}\n\nRequirements:\n${reqs}\n\nFees:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Late Registration of Birth]`;
      } else {
        responseText = `Tungkol sa Late Registration of Birth, narito ang mga hakbang:\n\n${steps}\n\nMga Kailangang Dokumento:\n${reqs}\n\nFiling Fees:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Late Registration of Birth]`;
      }
    } else if (matchedGuide.kb_id === 103) {
      if (lang === 'vis') {
        responseText = `Mahitungod sa Indigenous Peoples Registration (IPRA RA 8371), ania ang mga lakang:\n\n${steps}\n\nMga Kinahanglanon:\n${reqs}\n\nBayarin:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Indigenous Peoples Registration (IPRA RA 8371)]`;
      } else if (lang === 'eng') {
        responseText = `For Indigenous Peoples Registration (IPRA RA 8371), here are the steps:\n\n${steps}\n\nRequirements:\n${reqs}\n\nFees:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Indigenous Peoples Registration (IPRA RA 8371)]`;
      } else {
        responseText = `Tungkol sa Indigenous Peoples Registration (IPRA RA 8371), narito ang mga hakbang:\n\n${steps}\n\nMga Kailangang Dokumento:\n${reqs}\n\nFiling Fees:\n${matchedGuide.fees_text}\n\nTip: ${matchedGuide.tips}\n\n[CHECKLIST: Indigenous Peoples Registration (IPRA RA 8371)]`;
      }
    }
    return createReadableStreamResponse(responseText);
  }

  // 5. Default General Response (No match)
  if (lang === 'vis') {
    responseText = "Kumusta! Ako si CLARA. Ania ako aron mogiya kanimo sa pagkuha, pag-correct, o pagrehistro sa imong civil documents sama sa Birth, Marriage, o Death Certificates.\n\nPalihug isulti kanako ang imong partikular nga sitwasyon aron matabangan ka nako.";
  } else if (lang === 'eng') {
    responseText = "Hello! I am CLARA. I am here to help guide you in securing, correcting, or registering your civil documents such as Birth, Marriage, or Death Certificates.\n\nPlease describe your specific situation so I can assist you better.";
  } else {
    responseText = "Magandang araw! Ako si CLARA. Nandito ako upang gabayan ka sa pagkuha, pag-aayos, o pagpaparehistro ng iyong mga civil documents kagaya ng Birth, Marriage, o Death Certificates.\n\nI-type lamang ang iyong sitwasyon sa ibaba para matulungan kita.";
  }
  return createReadableStreamResponse(responseText);
}

// Helper to create a Next.js ReadableStream response that simulates text chunk streaming
function createReadableStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.split(" ");
  let i = 0;

  const stream = new ReadableStream({
    async start(controller) {
      function pushChunk() {
        if (i < chunks.length) {
          const chunkText = chunks[i] + (i === chunks.length - 1 ? "" : " ");
          const textToken = `0:${JSON.stringify(chunkText)}\n`;
          controller.enqueue(encoder.encode(textToken));
          i++;
          setTimeout(pushChunk, 40);
        } else {
          controller.close();
        }
      }
      pushChunk();
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
    }
  });
}