# 06 — Web Ingestion Handoff (for Justin / backend lane)

The "RAG Sitemap Scraper" is no longer a simulation. The frontend lane built a
real, allow-listed fetch→extract→chunk→embed→write pipeline and verified the
sources. This doc hands you the **backend finishing work**: pin the `sources`
schema, wire real provenance, extend the content gate, and harden for scale.

Design rationale + the full verified source inventory: [`../architecture/ADR-002-web-sitemap-ingestion.md`](../architecture/ADR-002-web-sitemap-ingestion.md).

---

## What already works (don't rebuild it)

| Piece | File | State |
|---|---|---|
| Curated source allow-list (4 statutes + PSA Helpline) + SSRF host allow-list | `src/lib/crawl-sources.ts` | done |
| Streaming ingest route — `preview` + `ingest` modes; cheerio extract; embeds via the ADR-001 path; writes `doc_chunks` as `unverified`; idempotent on `(text_hash, language)` | `src/app/api/admin/crawl/route.ts` | done |
| Admin UI — source dropdown, **Preview** + **Ingest to Vector DB** buttons, real streamed console, refreshes the vector index | `src/app/admin/dashboard/page.tsx` (RAG Source Ingester panel) | done |

**Verified (2026-06-24):** government portals (`psa.gov.ph`, `ncip.gov.ph`, `officialgazette.gov.ph`) **403-block automated fetches**; only `lawphil.net` (the statutes) and `psahelpline.ph` are fetchable. Ingesting **Act 3753** wrote 23 `unverified` chunks successfully. We do **not** evade the 403s.

---

## Your task list

### 1. DECISION + first blocker — pin the `sources` table schema
The ingest route currently writes `doc_chunks.source_id = null` and stashes the
source label in `chunk_title`, because the `sources` schema is ambiguous:

- [`01-supabase.md`](01-supabase.md) defines `sources.guide_id` as **NOT NULL**.
- The doc-05 sprintlog (`docs/dev_journal/sprintlogs/2026-06-23-doc05-knowledge-base.md`) defines it **nullable**, plus `url` + `verified_on`.

`CREATE TABLE IF NOT EXISTS` means whichever ran **first** is live. Confirm it:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'sources' order by ordinal_position;
```
A web-sourced chunk is **not** tied to a guide, so `guide_id` must be nullable.
If it isn't, run:
```sql
alter table sources alter column guide_id drop not null;
alter table sources add column if not exists url text;
alter table sources add column if not exists verified_on date;
create unique index if not exists sources_url_key on sources (url);   -- clean upsert key
```

### 2. Wire real provenance (`source_id`) into the ingest route
In `src/app/api/admin/crawl/route.ts`, inside the `mode === 'ingest'` loop,
**before** the chunk loop, upsert one `sources` row per source and reuse its id:
```ts
const { data: srcRow, error: srcErr } = await supabaseAdmin
  .from('sources')
  .upsert({ name: src.label, url: src.url, is_primary: src.kind === 'statute', verified_on: TODAY },
          { onConflict: 'url' })
  .select('source_id')
  .single();
// then on each doc_chunks insert: source_id: srcRow.source_id   (replace the null)
```
(`TODAY` — pass a date in; scripts here avoid `Date.now()` only in workflow land, a route can use `new Date()`.) This makes chat able to **cite the source URL** later via `sources.name/url`.

### 3. Decide `kb_id` for web chunks
Currently set from the source's `kb_id` (101/102/103) or `null` (PSA Helpline).
Decide whether scraped chunks should group under the existing `knowledge_base`
topics or a synthetic per-source `kb_id`. Low stakes; just make it deliberate.

### 4. Extend the doc-05 content gate to web chunks
The reviewer workflow ([`05a`](05a-content-review-workflow.md)/[`05b`](05b-review-worksheets.md))
covers the 3 structured guides. Scraped statute text is **also `unverified`** and
must not be activated until reviewed. Add a web-chunk worksheet (or a section in
`05b`) so a reviewer signs off before any `crawl`-ingested chunk goes `active`.
**Until then, leave ingested chunks `unverified`.**

### 5. Hardening (ADR-002 §8, Phase 2 — optional, not pilot-blocking)
- The route's `maxDuration = 60`; ingesting **all** sources may time out mid-run
  (it's idempotent — re-run resumes). Consider per-source runs or batching.
- BFS fallback, `robots.txt` compliance at scale, "skip recently scraped" via
  `sources.last_updated`, more sources — all Phase 2.

---

## Ground rules (non-negotiable — same as docs 00–05)
- **Unverified only.** `crawl`-ingested chunks stay `effective_status='unverified'` until a doc-05 reviewer activates them. Never auto-activate scraped content.
- **Keep the SSRF allow-list.** The client sends a source *id*; the route resolves the URL and re-checks the host (post-redirect) against `CRAWL_ALLOW_HOSTS`. Don't accept client URLs.
- **No anti-bot evasion.** The gov portals 403 on purpose; don't spoof UAs to get around it. Their procedure/fee content is human-curated (doc 05).
- Run `npm run build` after each change; keep it green.

## Verification
- `npm run build` green.
- `information_schema` confirms `sources.guide_id` nullable + `url` present.
- Ingest Act 3753 → `doc_chunks` rows now carry a real `source_id`, and a `sources` row holds the lawphil URL.
- Ingested chunks are `unverified` and invisible to chat until activated.
