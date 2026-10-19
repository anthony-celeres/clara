// src/lib/rag.ts
// Server-only RAG helpers shared by the chat route and the admin KB routes.
// (ADR-001) Do NOT import into client components — it reads the Gemini key.
import crypto from 'crypto';

export const EMBED_MODEL = 'gemini-embedding-001'; // verified live; pin it
export const EMBED_DIM = 768;                       // matches doc_chunks.embedding vector(768)

interface GuideLike {
  title: string;
  steps_json: { step_number: number; instruction: string }[];
  requirements_json: string[];
  fees_text: string;
  tips: string;
}

/** The exact text a guide is grounded on / embedded as. Keep in sync with scripts/ingest-kb.mjs. */
export function composeGuideText(g: GuideLike): string {
  const steps = (g.steps_json ?? []).map((s) => `${s.step_number}. ${s.instruction}`).join('\n');
  const reqs = (g.requirements_json ?? []).map((r) => `- ${r}`).join('\n');
  return [
    g.title,
    `Steps:\n${steps}`,
    `Requirements:\n${reqs}`,
    `Fees: ${g.fees_text}`,
    `Tip: ${g.tips}`,
  ].join('\n\n');
}

export function sha256(t: string): string {
  return crypto.createHash('sha256').update(t, 'utf8').digest('hex');
}

/** Embed text with Gemini and return a normalized 768-d vector. Throws on failure. */
export async function embedText(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'
): Promise<number[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key') {
    throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not configured');
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBED_DIM,
      }),
    }
  );
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const v: number[] = (await res.json())?.embedding?.values ?? [];
  if (v.length !== EMBED_DIM) throw new Error(`embed dim mismatch: got ${v.length}, want ${EMBED_DIM}`);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

/** pgvector text literal for an INSERT/UPDATE of a vector column. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`;
}
