# ADR-002 — Web / Sitemap Ingestion for the Knowledge Base

- **Status:** Proposed
- **Scope:** Admin "RAG Sitemap Scraper" (`src/app/admin/dashboard/page.tsx`), a new crawl API route, `doc_chunks` + `sources` writes
- **Supersedes:** the simulated crawler in `admin/dashboard/page.tsx` (`handleStartCrawl`, `SEED_SCRAPED_CHUNKS`) — currently UI theater that fetches nothing and writes no vectors
- **Builds on:** [ADR-001](ADR-001-rag-vector-architecture.md) (vector store, `embedText()`, `effective_status` gate)
- **Related standards:** `standards/canonical-source-ingestion.md`, `standards/government-pdf-extraction.md`, `standards/data-privacy-architecture.md`, `standards/deterministic-grounding.md`

---

## 1. Context

### What exists today
- **The scraper is a pure frontend simulation.** `handleStartCrawl` runs `setTimeout` loops that print `[SIMULATED]` log strings and fabricate chunk objects client-side. Its own logs say it plainly: *"UI preview only — no page is fetched and no vector is written."* The "152 chunks from 71 pages" figure is invented. The section carries a "Simulated" badge.
- **The real RAG substrate is built and reusable** (ADR-001): `src/lib/rag.ts → embedText()` returns live 768-d Gemini vectors; `doc_chunks` stores them; `sources` exists for citation provenance; `effective_status` gates retrieval.
- **`doc_chunks` already supports web provenance.** `source_id → sources(source_id)` is in the schema, and `guide_id` is nullable. A scraped chunk is `guide_id = null, source_id = <the page>` — **no schema change required** (mirrors ADR-001's "guide_id null, source_id set" PDF case).
- **No scraping/parsing dependencies are installed.** `package.json` has no HTML or XML parser.

### Forces
- The KB is 9 seed guides. Growing it by hand does not scale; the authoritative procedures live on agency sites (PSA, DFA, NCMF, NCIP).
- Synthesis and embedding both require the server (Gemini key is server-only) — scraping cannot live on the client.
- Government HTML is inconsistent: some sites lack a clean `sitemap.xml`, content is wrapped in heavy nav/boilerplate, and a few are JS-rendered.
- **This feeds the content gate; it does not satisfy it.** Scraped text is *candidate* content. Per [handoff doc 05](../handoff/05-knowledge-base-content.md) it must land `unverified` and pass a human domain reviewer before it is `active`. Scraping makes the KB *bigger*; doc-05 makes it *trustworthy*. (Same separation ADR-001 draws for the RAG engine.)

---

## 2. Decision

Build a **real, bounded, streaming server-side crawl** that turns the simulated scraper into genuine ingestion:

> A new admin-gated route `POST /api/admin/crawl` fetches an agency's `sitemap.xml`, selects civil-registry URLs, fetches a **bounded** set of pages politely, extracts main text, chunks it, embeds each chunk with the ADR-001 `embedText()` path, and writes `doc_chunks` rows as **`effective_status = 'unverified'`** with a `sources` provenance row per page — streaming real progress back to the dashboard console. The frontend `handleStartCrawl` is rewired to call it; the "Simulated" badge becomes a live status.

This is the **MVP scope**. BFS crawling, multi-agency breadth, robots-aware politeness at scale, and background processing for large crawls are **Phase 2** (§8).

---

## 3. Architecture

### 3.1 Route — `POST /api/admin/crawl` (streaming)
- Admin-gated by the existing proxy (`/api/admin/*`); writes via `supabaseAdmin` (service-role, bypasses RLS) as the other admin chunk routes do.
- Request: `{ agency: 'psa'|'dfa'|'ncmf'|'ncip', method: 'sitemap', maxPages?: number }`.
- Response: a streamed body of **NDJSON log events** (`{type:'log'|'page'|'chunk'|'done'|'error', ...}`) so the dashboard console shows *real* progress instead of canned strings.

### 3.2 Discovery — REVISED BY VERIFICATION (2026-06-24)

> **Verification finding (PSA):** `psa.gov.ph/sitemap.xml` exists and is valid, but lists **only 12 corporate/statistics pages and zero civil-registry pages**. The civil-registry content CLARA needs **does** live on `psa.gov.ph` (e.g. `/civilregistration`, `/civilregistration/facts`, `/birth-certificate`) — it is simply **absent from the sitemap**. Conclusion: **sitemap discovery is the wrong primary mechanism for this content** — it finds pages, but never the right ones.

Therefore the discovery backbone is a **curated authoritative-URL allow-list**, not crawling:
1. Maintain a small, reviewed list of **known authoritative URLs** per topic (e.g. `psa.gov.ph/civilregistration*`, `psa.gov.ph/birth-certificate`, the PSA online channel `psahelpline.ph`, and the primary **laws** themselves — RA 9048 / 10172 / 8371). Hand-picked, not discovered.
2. Sitemap.xml and BFS become **optional supplements** that merely *surface candidate* URLs for a human to add to the curated list — never an auto-ingest path.
3. **Hard exclusion:** the SEO/appointment blogs that dominate search results (`psa-onlineappointment.ph`, `requirementph.com`, …) are **not authoritative** and must never be ingested. The allow-list is government + primary-law domains only.

### 3.3 Fetch + extract
- Sequential fetch with a **polite delay** (~750ms) and a per-page timeout; descriptive `User-Agent`.
- Extract main text with **cheerio**: drop `script/style/nav/header/footer/aside`, prefer `<main>/<article>`, collapse whitespace. (Extraction quality is the main accuracy risk — §9.)
- Detect language per page with `franc-min` (already a dep) → map to `eng|fil|vis`, default `eng`.

### 3.4 Chunk → embed → write
1. **Chunk** extracted text on paragraph/sentence boundaries into ~600–1000 char chunks (no LLM in chunking, per `government-pdf-extraction.md`).
2. **Hash** `text_hash = sha256(verbatim_text)`; **skip** if `(text_hash, language)` already exists (the ADR-001 idempotency key).
3. **Provenance:** upsert a `sources` row `{ name: <page title>, url: <page url>, is_primary: false, last_updated: now }`; keep its `source_id`.
4. **Embed** via `rag.ts → embedText(chunk, 'RETRIEVAL_DOCUMENT')` (768-d, normalized).
5. **Insert** `doc_chunks { source_id, guide_id: null, kb_id: null, language, chunk_title, verbatim_text, text_hash, effective_status: 'unverified', embedding, embed_model }`.

### 3.5 Frontend rewire
- `handleStartCrawl` → `fetch('/api/admin/crawl', { stream })`, read the NDJSON stream, append **real** log lines to the existing console UI, then refresh the chunk list (`GET /api/admin/chunks`).
- Remove `SEED_SCRAPED_CHUNKS` and the `[SIMULATED]` strings. The "Sitemap.xml" method ships; "BFS Crawl" stays in the UI but **disabled with a "Phase 2" tag** (no fake affordance — same honesty rule ADR-001 §1 applied to the vector claims).

---

## 4. Security — the part that matters most

**A server route that fetches URLs is an SSRF vector.** Mitigations are non-negotiable:

- **Domain allow-list.** The route fetches **only** a hardcoded set of agency origins (`psa.gov.ph`, `dfa.gov.ph`, `ncmf.gov.ph`, `ncip.gov.ph`). The client sends an `agency` **key**, never a URL. No user-supplied URL is ever fetched.
- **Resolve-and-recheck.** After redirects, re-validate the final host is still on the allow-list; refuse cross-host redirects (blocks open-redirect → SSRF).
- **Scheme + port lock:** `https` only; reject non-standard ports and any host that resolves to a private/loopback/link-local range.
- **Admin-gated + service-role writes** as with the other `/api/admin/*` routes.
- **No secrets outbound:** the crawl fetch carries no auth headers; only the embedding call uses the Gemini key, server-side.

---

## 5. Production constraint — bounded by design

A 71-page crawl + an embed call per chunk **cannot complete in one serverless invocation** (Vercel function timeout 10–60s). Therefore:

- **`maxPages` is bounded per invocation** (default ~10, hard cap ~25) so one run fits the function budget; set `export const maxDuration` on the route to the plan's ceiling.
- Larger corpora are gathered across **multiple runs** (the UI can loop), with the future "skip recently scraped" filter (§8) preventing rework.
- **No silent truncation:** when the crawl stops at `maxPages`, the streamed `done` event says so explicitly (count fetched vs. count available).

---

## 6. Content-gate integration

```
crawl → doc_chunks (unverified) → [doc-05 human review: 05a/05b] → activate → retrievable
```

Scraped chunks are invisible to citizens until a reviewer signs off (handoff 05a/05b workflow). This ADR's writes deliberately stop at `unverified`. The reviewer worksheets already cover *guides*; a follow-up extends them (or a sibling sheet) to cover scraped web chunks before any are activated.

---

## 7. Dependencies

- **Add `cheerio`** (HTML parsing/extraction). Mature, no native build, server-only.
- Sitemap XML: small enough to parse with `cheerio`/`DOMParser`-style traversal or a tiny regex over `<loc>`; avoid adding a second XML lib if cheerio suffices.
- Reuse: `franc-min` (lang), `rag.ts` (embed), `supabase-admin` (writes). No new infra.

---

## 8. Phasing

| Phase | Scope |
|---|---|
| **1 (this ADR, decided)** | **curated authoritative-URL ingestion** (§3.2): fetch a reviewed allow-list of known gov / primary-law URLs → bounded real fetch+extract+embed → `unverified` writes + provenance → streaming logs → UI rewire. Sitemap.xml = optional candidate-surfacing only (verified insufficient for PSA content). PSA first. |
| **2 (future)** | BFS fallback for sites without a sitemap; full `robots.txt` compliance; real "skip pages scraped in last 7 days" via `sources.last_updated`; background/batched processing for large crawls; per-agency extraction tuning; web-chunk reviewer worksheet. |

---

## 9. Risks & open questions

- **Extraction quality.** Boilerplate-stripping gov HTML is noisy; bad chunks could be embedded. *Mitigation:* `unverified` status + human review is the backstop; consider a per-chunk low-confidence flag. **Garbage in is caught by doc-05, not by the crawler.**
- **Sitemap availability — VERIFIED, and it changes the design (2026-06-24).** `psa.gov.ph/sitemap.xml` exists and is valid but lists **only 12 corporate/statistics URLs and ZERO civil-registry pages** (`/`, `/about`, `/directory`, `/statistics`, `/career`, `/openstat`, `/procurement`…). The civil-registry content **does** exist on `psa.gov.ph` (`/civilregistration/facts`, `/birth-certificate`, …) but is **not in the sitemap** — so sitemap discovery cannot reach it. **This drove the §3.2 pivot to a curated authoritative-URL allow-list.** Also: `psa.gov.ph` robots.txt has no `Sitemap:` line (never infer "no sitemap" from that — the file is at the conventional path anyway) and disallows AI-crawler UAs (`ClaudeBot`/`GPTBot`, `ai-train=no`) — our purpose is citizen-guidance grounding, not training, but use an honest UA and respect the site. **Still open:** DFA/NCMF/NCIP source locations. *(Two external checks were wrong before this: one resolved "PSA" to `psacard.com` (Professional Sports Authenticator) and concluded "no sitemap"; the sitemap that does exist is real but useless for our content. Disambiguate the agency AND verify content coverage — not just file existence — before trusting any such check.)*
- **JS-rendered pages.** Plain `fetch` won't run client JS. Most gov pages are SSR; a headless browser (Playwright) is explicitly **out of scope** for MVP (infra weight).
- **`kb_id` for web chunks.** Left `null` in MVP (chunk ties to `sources`, not a `knowledge_base` topic). *Open question:* whether to map scraped chunks to a synthetic per-agency `kb_id` for admin grouping.
- **Politeness / ToS.** Public info, but crawl politely (delay, low `maxPages`, identifying UA). Full robots.txt compliance is Phase 2.
- **Cost / rate limits.** Embedding every chunk hits Gemini free-tier limits; `maxPages` bounding doubles as a cost bound.

---

## 10. Consequences

- **Positive:** the scraper becomes real and honest; the KB can grow from authoritative agency sources; provenance is captured for citation; clean handoff into the doc-05 gate; no new infra beyond `cheerio`.
- **Negative:** online-only, bounded crawls (not a one-click full-site mirror); extraction quality varies and leans on human review; adds an external-fetch surface that must stay locked behind the §4 allow-list; another external dependency (gov site structure) subject to drift.

---

## 11. Cross-lane note

RAG/ingestion is nominally the backend lane (handoff doc 03). The RAG pipeline (ADR-001) was in fact built by the frontend lane, and this ADR continues that. To avoid a repeat of the parallel-fix collision on `doc_chunks`/RAG, **coordinate ownership of the crawl route before implementation** — one lane owns `/api/admin/crawl`.

---

## 12. Verified source inventory (2026-06-24) — reshapes the feature

Every candidate URL was fetched and checked. **Decisive result: every `.gov.ph` agency site tested returns `403 Forbidden` to automated fetches** (Cloudflare bot protection + the AI-UA disallow in robots.txt). The only reliably automatable authoritative sources are **lawphil.net** (primary law; not a `.gov.ph` host) and **psahelpline.ph** (PSA's authorized online channel).

**Automatable — verified fetchable + authoritative:**

| URL | Content | Guide | Verified |
|---|---|---|---|
| `lawphil.net/statutes/repacts/ra2001/ra_9048_2001.html` | RA 9048 — clerical/typo + first-name correction | 101 | ✅ full text |
| `lawphil.net/statutes/repacts/ra2012/ra_10172_2012.html` | RA 10172 — day/month-of-birth + sex correction | 101 | ✅ full text |
| `lawphil.net/statutes/acts/act1930/act_3753_1930.html` | Act 3753 — Civil Register Law (late-reg basis) | 102 | ✅ full text |
| `lawphil.net/statutes/repacts/ra1997/ra_8371_1997.html` | RA 8371 — IPRA | 103 | ✅ full text |
| `psahelpline.ph` (+ `/faq`, ordering/payment/delivery) | PSA online request procedure, posting periods | 101/102 | ✅ fetchable, authorized PSA provider (fees on sub-pages) |

**NOT automatable — authoritative but `403` bot-blocked → must be human-curated:**

| URL | Content | Result |
|---|---|---|
| `psa.gov.ph/civilregistration`, `/birth-certificate` | PSA procedure/fee pages | `403` |
| `ncip.gov.ph` | NCIP / IPRA registration + BRAP | `403` |
| `officialgazette.gov.ph` | issuances / gazetted laws | `403` |

**Consequence — the feature narrows honestly:**
- The crawler automates the **legal basis** (statutes from lawphil) + psahelpline procedures — **not** the agency procedure/fee pages, which 403.
- The citizen-facing **procedure/fee** content lives on bot-blocked gov sites → **human curation** (which is the doc-05 path anyway). Statutes give grounding + citation; humans still supply the steps/fees.
- This makes the tool a **primary-law + psahelpline ingester**, not a gov-portal crawler. The UI's per-agency PSA/DFA/NCMF/NCIP selector is largely aspirational given the 403s — the UI must not offer agencies we cannot actually fetch.
- We do **not** attempt to evade the 403s (UA spoofing / anti-bot bypass) — the sites signal they don't want automated access; respect it.
