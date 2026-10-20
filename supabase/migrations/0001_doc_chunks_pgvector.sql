-- 0001_doc_chunks_pgvector.sql
-- Step 1 of ADR-001 (docs/architecture/ADR-001-rag-vector-architecture.md):
-- stand up the vector store for CLARA's RAG retrieval.
--
-- Apply in Supabase → SQL Editor (DDL is not run through the JS client).
-- Safe to re-run: every statement is guarded with IF [NOT] EXISTS.

-- 1. pgvector extension --------------------------------------------------------
create extension if not exists vector;

-- 2. doc_chunks table ----------------------------------------------------------
-- One row per retrievable chunk. A chunk may derive from a structured guide
-- (guide_id set) or an ingested PDF (guide_id null, source_id set).
create table if not exists doc_chunks (
  chunk_id         bigserial primary key,
  kb_id            int references knowledge_base(kb_id),
  guide_id         int references guides(guide_id),
  source_id        int references sources(source_id),   -- provenance for citation
  language         text not null check (language in ('eng', 'fil', 'vis')),
  chunk_title      text,
  verbatim_text    text not null,                        -- exact text shown to the model
  text_hash        text not null,                        -- sha256(verbatim_text)
  page_range       text,                                 -- PDF provenance; null for guides
  effective_status text not null default 'unverified'
                     check (effective_status in ('active', 'unverified', 'ocr_unreviewed')),
  embedding        vector(768),                          -- gemini-embedding-001 @ dim 768
  embed_model      text not null default 'gemini-embedding-001',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Idempotent re-ingestion key: unchanged text (same hash) is not re-embedded.
create unique index if not exists doc_chunks_text_hash_lang_idx
  on doc_chunks (text_hash, language);

-- 3. indexes -------------------------------------------------------------------
-- HNSW cosine index (pgvector). Index tuning is irrelevant at pilot corpus size;
-- HNSW caps at 2000 dims, which is why ADR-001 pins the embedding to 768.
create index if not exists doc_chunks_embedding_idx
  on doc_chunks using hnsw (embedding vector_cosine_ops);

-- Supports the language + status pre-filter applied before the kNN scan.
create index if not exists doc_chunks_lang_status_idx
  on doc_chunks (language, effective_status);

-- Zero-cost full text / trigram search index
create index if not exists doc_chunks_verbatim_trgm_idx
  on doc_chunks using gin (verbatim_text gin_trgm_ops);

-- 4. row-level security --------------------------------------------------------
-- Public (anon + authenticated) may read ONLY activated chunks — mirrors the
-- public-read posture of guides/knowledge_base/sources (handoff 01 §3).
-- No write policy is defined, so writes are denied to anon/authenticated; the
-- ingestion script writes with the service-role key, which bypasses RLS.
alter table doc_chunks enable row level security;

drop policy if exists doc_chunks_public_read on doc_chunks;
create policy doc_chunks_public_read on doc_chunks
  for select
  using (effective_status = 'active');
