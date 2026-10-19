# ADR-001 — Knowledge Base, RAG & Vector Database

- **Status:** Proposed
- **Scope:** CLARA chat retrieval (`src/app/api/chat/route.ts`), knowledge-base storage (Supabase), admin KB manager
- **Supersedes:** the keyword `if/else` retrieval described as "prototype behavior" in [`../handoff/03-gemini-rag.md`](../handoff/03-gemini-rag.md)
- **Related standards:** `standards/lightweight-pdf-rag.md`, `standards/deterministic-grounding.md`, `standards/government-pdf-extraction.md`, `standards/canonical-source-ingestion.md`

---

## 1. Context

### What exists today
- **Retrieval is hardcoded keyword matching.** `chat/route.ts` does `queryLower.includes('clerical') → fetchGuide(101)` against three hardcoded `kb_id`s. No embeddings, no similarity search, no full-text search.
- **No vector store.** The `guides` table ([`../handoff/01-supabase.md:68`](../handoff/01-supabase.md)) has no vector column. No chunk table exists.
- **The admin KB UI fakes a vector pipeline.** `admin/dashboard/page.tsx` prints "computed vector floats via text-embedding-3-small", "stored in pgvector table", "cosine similarity > 0.84", and offers a "Re-embed" button — all cosmetic. Nothing is embedded or stored. **This ADR's implementation must make those claims real or remove them; the UI must not assert a system that does not exist.**
- **Content is unverified prototype seed data.** [`../handoff/05-knowledge-base-content.md`](../handoff/05-knowledge-base-content.md) blocks citizen launch until guides trace to cited legal sources. **This ADR builds the retrieval engine; it does not satisfy the content gate.** The two are separate workstreams.

### Forces
- CLARA already runs **Supabase/Postgres** (pgvector is one `CREATE EXTENSION` away) and has a working **Gemini API key** (embeddings available via the same key/SDK).
- The corpus is multilingual (eng/fil/vis). Cross-language semantic recall rules out plain Postgres full-text search as the primary path.
- The corpus is tiny now (3 topics × 3 languages) but will grow as government PDFs (PSA, NCIP, NCMF) are ingested.
- Synthesis (the Gemini answer) requires connectivity regardless of retrieval design, so offline *chat* is already constrained by the LLM call, not just retrieval.

---

## 2. Decision

Build **real RAG on the existing stack**: chunk knowledge content, embed it with **Gemini `gemini-embedding-001` (768-dim, Matryoshka-truncated)**, store vectors in a **Supabase `pgvector`** table, and retrieve by **cosine kNN server-side** inside `/api/chat`, feeding retrieved verbatim chunks to Gemini under the existing deterministic-grounding contract.

This is **Option A** from the architecture review: real RAG, minimal new infra (pgvector extension only), reusing Supabase + the Gemini key already in place.

### Model facts (verified live against the API, 2026-06-23)
- `text-embedding-004` and `gemini-1.5-flash` are **retired** (404 / not listed). Do not reference them.
- Embedding model: **`gemini-embedding-001`**, called with `outputDimensionality: 768` (verified to return 768 floats). Default is 3072, which **exceeds pgvector's HNSW index limit (2000)** — 768 keeps the table small and indexable.
- Synthesis model: **`gemini-2.5-flash`** (already wired in `chat/route.ts`).
- **Pin both as centralized constants.** Re-verify availability before relying on either — the retired-model trap has bitten this project twice.

---

## 3. Deviation record — vs. `standards/lightweight-pdf-rag.md`

The standard is **provisional** (CLARA would be its 2nd adopter) and explicitly invites divergence notes. This ADR deviates deliberately:

| Aspect | Standard (lightweight-pdf-rag) | CLARA (this ADR) | Why |
|---|---|---|---|
| Embedder | BAAI/bge-m3 (1024-dim) on shared Cloud Run | Gemini `gemini-embedding-001` (768-dim) | Reuse existing Gemini key; no Cloud Run infra to stand up for a tiny corpus |
| Vector store | IndexedDB on client | Supabase pgvector (server) | Existing Postgres; online-only retrieval acceptable because synthesis needs online anyway |
| Retrieval compute | Web Worker browser cosine | Postgres `<=>` cosine (server) | No client bundle/precache pipeline needed for the pilot |
| Offline retrieval | Yes (precached corpus) | No — offline keeps the current **static guide cache** (localForage) | Offline chat can't synthesize regardless; static guides cover the offline story for the pilot |

**Kept from the standard (non-negotiable):**
- Cosine similarity (not dot/L2).
- Per-chunk `verbatim_text` + `text_hash` + provenance (`source_id`, `page_range`).
- `effective_status` gating: new chunks are `unverified` until a domain reviewer activates them; OCR-low chunks quarantined.
- Deterministic grounding: facts come from chunk metadata/reference tables, never LLM-generated.
- Eval harness (subset, §7).

**Why this isn't a dead end:** the chunk schema below is export-compatible with the standard's Pattern d.i. If offline kiosk RAG later becomes a hard requirement, the same `verbatim_text` + `embedding` + metadata rows export to an IndexedDB bundle without re-architecting — we add a layer, we don't rewrite.

---

## 4. Schema (new)

```sql
create extension if not exists vector;

-- One row per retrievable chunk. A chunk may derive from a structured guide
-- (guide_id set) or an ingested PDF (guide_id null, source_id set).
create table doc_chunks (
  chunk_id         bigserial primary key,
  kb_id            int references knowledge_base(kb_id),
  guide_id         int references guides(guide_id),
  source_id        int references sources(source_id),     -- provenance for citation
  language         text not null,                          -- 'eng' | 'fil' | 'vis'
  chunk_title      text,
  verbatim_text    text not null,                          -- exact text shown to the model
  text_hash        text not null,                          -- sha256(verbatim_text) — integrity
  page_range       text,                                   -- PDF provenance, null for guides
  effective_status text not null default 'unverified',     -- 'active' | 'unverified' | 'ocr_unreviewed'
  embedding        vector(768),                            -- gemini-embedding-001 @ dim 768
  embed_model      text not null default 'gemini-embedding-001',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- HNSW cosine index (pgvector). lists/m tuning is irrelevant at pilot corpus size.
create index doc_chunks_embedding_idx
  on doc_chunks using hnsw (embedding vector_cosine_ops);

create index doc_chunks_lang_status_idx
  on doc_chunks (language, effective_status);
```

**RLS:** `doc_chunks` is public-readable for `effective_status = 'active'` (same posture as `guides`); writes gated behind admin in the API layer. Mirror the pattern in [`../handoff/01-supabase.md:150`](../handoff/01-supabase.md).

**Dimension pinning:** every embedding write asserts `length = 768`; reads assert the stored `embed_model` matches the query embedder. A mismatch is a hard fail, never a silent coerce (per the standard).

---

## 5. Ingestion pipeline

Run server-side (Gemini key is server-only; service-role for writes). Pilot form: a Node script (`scripts/ingest-kb.ts`); later promotable to an admin API route so the "Re-embed" button becomes real.

1. **Source.**
   - *Structured guides* (today): compose a text representation per guide+language (`title` + steps + requirements + `fees_text` + tips). Guides are small → typically one chunk each, or split by section if long.
   - *Government PDFs* (later): Phase 0 triage per `government-pdf-extraction.md` (text-extractable vs scanned→OCR; segment >15pp into overlapping 5-page ranges); hybrid section + sentence-boundary chunking, **no LLM in chunking**.
2. **Hash.** `text_hash = sha256(verbatim_text)`.
3. **Embed.** Batch via Gemini `embedContent` / AI SDK `embedMany`, `outputDimensionality: 768`, `taskType: RETRIEVAL_DOCUMENT`. **Normalize truncated vectors to unit length** (Matryoshka truncation below native dim is not pre-normalized).
4. **Upsert.** Write `doc_chunks` with `effective_status = 'unverified'`. Idempotent on `text_hash` — unchanged text is not re-embedded.
5. **Activate.** A domain reviewer flips `effective_status → 'active'` (ties to the doc-05 content gate). Only `active` chunks are retrievable.
6. **Re-embed.** On content edit, hash changes → re-embed that chunk only.

---

## 6. Retrieval + grounding contract

In `/api/chat`, replacing the keyword `if/else`:

1. **PII first.** `scrubPII(lastUserMessage)` — unchanged, runs before anything leaves the server. Never embed/synthesize raw input.
2. **Detect language** (`detectLanguage` / franc-min) — unchanged.
3. **Embed the query** with `gemini-embedding-001`, `outputDimensionality: 768`, `taskType: RETRIEVAL_QUERY`; normalize.
4. **Cosine kNN** (prefer detected language, fall back to `'fil'`):
   ```sql
   select chunk_id, guide_id, source_id, chunk_title, verbatim_text,
          1 - (embedding <=> $1) as similarity
   from doc_chunks
   where effective_status = 'active' and language = $2
   order by embedding <=> $1
   limit $k;            -- pilot k = 5
   ```
5. **Relevance gate.** If top similarity `< τ` (start τ ≈ 0.70, tune on the eval set), treat as **no match** → CLARA defers to the LCRO. **Do not force-ground on an irrelevant chunk.** This preserves the grounding guarantee for out-of-scope questions.
6. **Deterministic citation.** Build the `VERIFIED GUIDELINES` block from each chunk's `verbatim_text`; attach citation (`sources.name` / `url`, `chunk_id`) **looked up from tables, not generated**. Inject the constrained list; the model weaves narrative and may cite **only** from it.
7. **Preserve existing contracts:** the `SYSTEM_PROMPT` "answer ONLY from provided content, defer to LCRO when unknown" intent verbatim; the `[CHECKLIST: Guide Title]` trailer (frontend parses it to render the checklist card); the `0:"text"` stream format and graceful degradation already in the route.

---

## 7. Eval plan (subset of standard E1–E6)

Build a small gold set of real-style questions (eng/fil/vis) with expected source chunks. Gate launch on:

- **E2 — Multilingual equivalence (PRIORITY):** same question in eng/fil/vis retrieves the same source and yields equivalent answers.
- **E3 — Citation accuracy:** the answer cites a chunk that was actually retrieved; no fabricated citations.
- **E4 — Quote-out-of-context:** retrieved verbatim text is not stitched into a misleading claim.
- **E6 — Refusal/deferral consistency:** out-of-scope questions defer to the LCRO consistently across all three languages (exercises the §6.5 relevance gate).
- **Retrieval precision@k** on the gold set; tune `τ` and `k`.
- *(E1 partisan-refusal and E5 adversarial-screenshot are low-relevance for the civil-registry domain — note as N/A for the pilot.)*

---

## 8. Risks & open questions

- **Content gate unmet.** RAG engine ≠ verified content. Doc-05 still blocks citizen launch until guides trace to cited primary sources and a reviewer signs off. The `effective_status` workflow operationalizes this.
- **Model churn.** Embedding/synthesis model ids have been retired twice on this project. Centralize as constants; re-verify before each reliance; assert returned dims.
- **768 vs 1024 deviation.** Quality delta vs. bge-m3 is unmeasured for fil/vis. The eval set is how we catch it; revisit if E2/precision underperform.
- **Cost / rate limits.** Gemini embedding free-tier limits apply to ingestion batches and per-query embedding; batch ingestion, cache query embeddings if needed.
- **PII in chunks.** Chunks are government guide text (no citizen PII) — safe to store. Re-affirm for any future user-derived corpus.
- **Dual source of truth.** Unrelated to RAG but noted: feedback/analytics already split Firestore vs. Supabase ([`../handoff/01-supabase.md:115`](../handoff/01-supabase.md)); KB stays single-sourced in Supabase.

---

## 9. Consequences

- **Positive:** real semantic + multilingual retrieval; admin edits take effect (RAG reads the DB); the admin UI's vector claims can become true; clean migration path to offline IndexedDB if needed; no new infra beyond the pgvector extension.
- **Negative:** online-only retrieval (offline = static guides only); a deliberate, documented deviation from the house standard that future maintainers must understand (this ADR is that record); embedding model is an external dependency subject to churn.
