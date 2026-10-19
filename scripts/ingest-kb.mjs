// scripts/ingest-kb.mjs
// Step 2 of ADR-001: seed the structured KB tables and embed each guide into
// doc_chunks for RAG retrieval.
//
//   node scripts/ingest-kb.mjs        (or: npm run ingest:kb)
//
// What it does, idempotently:
//   1. knowledge_base  <- one row per kb_id (title, category)
//   2. guides          <- the 9 GUIDES_SEED rows (so the DB, not the hardcoded
//                         fallback, becomes the source of truth)
//   3. doc_chunks      <- one embedded chunk per guide, effective_status
//                         'unverified' (NOT retrievable until a reviewer
//                         activates it — see ADR-001 §5 + handoff doc 05)
//
// Re-running is safe: structured rows upsert on their PK; chunks are skipped
// when an identical (text_hash, language) already exists, so no wasted embeds.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- env (standalone script: parse .env.local ourselves) ---------------------
const env = {};
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8').split(/\r?\n/)) {
  const i = line.indexOf('=');
  if (i > 0 && !line.startsWith('#')) env[line.slice(0, i)] = line.slice(i + 1);
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = env.GOOGLE_GENERATIVE_AI_API_KEY;

const EMBED_MODEL = 'gemini-embedding-001'; // verified live 2026-06-23; pin it
const EMBED_DIM = 768;                       // pgvector HNSW caps at 2000 (ADR-001)

if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error('Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY');
  process.exit(1);
}

// --- load GUIDES_SEED from the TS file (string-aware bracket match, no deps) --
function extractArrayLiteral(src, name) {
  const open = src.indexOf('[', src.indexOf('=', src.indexOf(name)));
  let depth = 0, inStr = false, q = '';
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === q) inStr = false;
    } else if (c === '"' || c === "'" || c === '`') { inStr = true; q = c; }
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`could not extract ${name}`);
}
const seedSrc = fs.readFileSync(path.join(ROOT, 'src/lib/seed-data.ts'), 'utf-8');
const GUIDES_SEED = new Function('return ' + extractArrayLiteral(seedSrc, 'GUIDES_SEED'))();

// --- helpers -----------------------------------------------------------------
const sha256 = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

// The exact text the model will be grounded on for this guide.
function composeText(g) {
  const steps = g.steps_json.map((s) => `${s.step_number}. ${s.instruction}`).join('\n');
  const reqs = g.requirements_json.map((r) => `- ${r}`).join('\n');
  return [
    g.title,
    `Steps:\n${steps}`,
    `Requirements:\n${reqs}`,
    `Fees: ${g.fees_text}`,
    `Tip: ${g.tips}`,
  ].join('\n\n');
}

async function embed(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: EMBED_DIM,
    }),
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status} ${await res.text()}`);
  const v = (await res.json()).embedding.values;
  if (v.length !== EMBED_DIM) throw new Error(`dim mismatch: got ${v.length}, want ${EMBED_DIM}`);
  // MRL-truncated vectors are not unit length; normalize for stable cosine.
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map((x) => x / norm);
}

// --- run ---------------------------------------------------------------------
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// 1. knowledge_base (one row per kb_id)
const kbRows = [...new Map(
  GUIDES_SEED.map((g) => [g.kb_id, {
    kb_id: g.kb_id, title: g.title, category: g.category, version: 'seed-v1', is_active: true,
  }])
).values()];
{
  const { error } = await db.from('knowledge_base').upsert(kbRows, { onConflict: 'kb_id' });
  if (error) throw error;
  console.log(`knowledge_base: upserted ${kbRows.length}`);
}

// 2. guides (DB table has no `category` column — that lives on knowledge_base)
const guideRows = GUIDES_SEED.map(({ category, ...g }) => g);
{
  const { error } = await db.from('guides').upsert(guideRows, { onConflict: 'guide_id' });
  if (error) throw error;
  console.log(`guides: upserted ${guideRows.length}`);
}

// 3. doc_chunks (embed each guide; skip if identical text already embedded)
let embedded = 0, skipped = 0;
for (const g of GUIDES_SEED) {
  const text = composeText(g);
  const hash = sha256(text);
  const { data: existing } = await db
    .from('doc_chunks').select('chunk_id').eq('text_hash', hash).eq('language', g.language).maybeSingle();
  if (existing) { skipped++; continue; }

  const emb = await embed(text);
  const { error } = await db.from('doc_chunks').insert({
    kb_id: g.kb_id,
    guide_id: g.guide_id,
    language: g.language,
    chunk_title: g.title,
    verbatim_text: text,
    text_hash: hash,
    effective_status: 'unverified',
    embedding: `[${emb.join(',')}]`,
    embed_model: EMBED_MODEL,
  });
  if (error) throw error;
  embedded++;
  console.log(`  embedded guide ${g.guide_id} "${g.title}" (${g.language})`);
}
console.log(`doc_chunks: embedded ${embedded}, skipped ${skipped}`);
console.log('DONE');
