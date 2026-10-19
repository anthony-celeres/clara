// src/app/api/admin/crawl/route.ts
// ADR-002 — real KB ingestion from curated authoritative sources.
//
// POST { sourceId: string | 'all', mode?: 'preview' | 'ingest' }
//   → streams NDJSON progress events while it genuinely fetches each curated
//     source, extracts main text (cheerio), and chunks it.
//   • mode 'preview' (default): fetch + extract + chunk only. No DB writes.
//   • mode 'ingest': additionally embed each chunk (Gemini, ADR-001 path) and
//     INSERT into doc_chunks as effective_status 'unverified' — NOT retrievable
//     until a doc-05 reviewer activates it. Idempotent on (text_hash, language).
//
// Admin-gated by the proxy (/api/admin/*).
//
// Provenance: writes source_id = null for now (the `sources` table's guide_id
// nullability differs between doc 01 and the doc-05 sprintlog — pin it before
// linking a sources row). The source label is carried in chunk_title meanwhile.
//
// Security (ADR-002 §4): the client sends a source *id*, never a URL. The URL is
// looked up server-side and the *resolved* host (post-redirect) is re-checked
// against CRAWL_ALLOW_HOSTS — SSRF defense.

import { type NextRequest } from 'next/server';
import * as cheerio from 'cheerio';
import { CRAWL_SOURCES, CRAWL_ALLOW_HOSTS, getCrawlSource, type CrawlSource } from '@/lib/crawl-sources';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { embedText, sha256, toVectorLiteral, EMBED_MODEL } from '@/lib/rag';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UA =
  'CLARA-AI4GOV-KB/0.1 (civic guidance ingester; +https://github.com/AI4GOV; not for AI training)';

function hostAllowed(u: string): boolean {
  try {
    return (CRAWL_ALLOW_HOSTS as readonly string[]).includes(new URL(u).hostname);
  } catch {
    return false;
  }
}

/** Fetch a page and extract readable main text. Throws on non-OK or off-list host. */
async function fetchAndExtract(url: string): Promise<{ title: string; text: string }> {
  if (!hostAllowed(url)) throw new Error(`host not allow-listed: ${url}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
  });
  if (!hostAllowed(res.url)) throw new Error(`redirected off allow-list: ${res.url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer, aside, noscript, form').remove();
  const title = ($('title').first().text() || '').trim() || url;
  const root = $('main').text() || $('article').text() || $('body').text();
  const text = root.replace(/\s+/g, ' ').trim();
  return { title, text };
}

/** Split text into ~targetChars chunks on sentence/space boundaries (no LLM). */
function chunkText(text: string, targetChars = 900): string[] {
  if (!text) return [];
  const out: string[] = [];
  let buf = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (buf && buf.length + sentence.length + 1 > targetChars) {
      out.push(buf.trim());
      buf = '';
    }
    buf += (buf ? ' ' : '') + sentence;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export async function POST(req: NextRequest): Promise<Response> {
  let sourceId = '';
  let mode: 'preview' | 'ingest' = 'preview';
  try {
    const body = await req.json();
    sourceId = body?.sourceId ?? '';
    if (body?.mode === 'ingest') mode = 'ingest';
  } catch {
    /* fall through to validation */
  }

  const sources: CrawlSource[] =
    sourceId === 'all' ? CRAWL_SOURCES : ([getCrawlSource(sourceId)].filter(Boolean) as CrawlSource[]);

  if (!sources.length) {
    return Response.json(
      { success: false, error: `unknown sourceId '${sourceId}'; expected 'all' or one of ${CRAWL_SOURCES.map((s) => s.id).join(', ')}` },
      { status: 400 }
    );
  }

  if (mode === 'ingest' && !supabaseAdmin) {
    return Response.json(
      { success: false, error: 'ingest needs SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL configured' },
      { status: 503 }
    );
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(enc.encode(JSON.stringify(e) + '\n'));
      let ok = 0;
      let failed = 0;
      let totalChunks = 0;
      let embedded = 0;
      let skipped = 0;

      send({
        type: 'start',
        count: sources.length,
        mode,
        msg:
          mode === 'ingest'
            ? `Ingesting ${sources.length} source(s): fetch → extract → embed → write doc_chunks (unverified).`
            : `Preview of ${sources.length} source(s): fetch + extract only, no vectors written.`,
      });

      for (const src of sources) {
        send({ type: 'log', msg: `→ ${src.label}` });
        send({ type: 'log', msg: `  GET ${src.url}` });

        let chunks: string[];
        try {
          const { title, text } = await fetchAndExtract(src.url);
          chunks = chunkText(text);
          totalChunks += chunks.length;
          ok++;
          send({ type: 'source', id: src.id, status: 'ok', title, chars: text.length, chunks: chunks.length, sample: chunks[0]?.slice(0, 180) ?? '' });
          send({ type: 'log', msg: `  ✓ "${title}" — ${text.length.toLocaleString()} chars → ${chunks.length} chunks` });
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          send({ type: 'source', id: src.id, status: 'error', error: msg });
          send({ type: 'log', msg: `  ✗ FAILED: ${msg}` });
          await new Promise((r) => setTimeout(r, 750));
          continue;
        }

        if (mode === 'ingest' && supabaseAdmin) {
          let srcEmbedded = 0;
          let srcSkipped = 0;
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const hash = sha256(chunk);
            try {
              const { data: existing } = await supabaseAdmin
                .from('doc_chunks')
                .select('chunk_id')
                .eq('text_hash', hash)
                .eq('language', src.language)
                .maybeSingle();
              if (existing) { srcSkipped++; skipped++; continue; }

              const emb = await embedText(chunk, 'RETRIEVAL_DOCUMENT');
              const { error } = await supabaseAdmin.from('doc_chunks').insert({
                kb_id: src.kb_id,
                guide_id: null,
                source_id: null,
                language: src.language,
                chunk_title: `${src.label} [${i + 1}/${chunks.length}]`,
                verbatim_text: chunk,
                text_hash: hash,
                effective_status: 'unverified',
                embedding: toVectorLiteral(emb),
                embed_model: EMBED_MODEL,
              });
              if (error) throw new Error(error.message);
              srcEmbedded++;
              embedded++;
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              send({ type: 'log', msg: `    ! chunk ${i + 1} failed: ${msg}` });
            }
            if ((i + 1) % 5 === 0) send({ type: 'log', msg: `    …embedded ${srcEmbedded}/${chunks.length}` });
          }
          send({ type: 'log', msg: `  ▸ wrote ${srcEmbedded} new unverified chunk(s), skipped ${srcSkipped} existing` });
        }

        await new Promise((r) => setTimeout(r, 750));
      }

      send({
        type: 'done',
        mode,
        ok,
        failed,
        totalChunks,
        embedded,
        skipped,
        msg:
          mode === 'ingest'
            ? `Ingest complete: ${embedded} chunk(s) written (unverified), ${skipped} already present, ${failed} source(s) failed. Activate via the chunk list after review.`
            : `Preview complete: ${ok} ok, ${failed} failed, ${totalChunks} chunks extracted. No vectors written (preview mode).`,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
