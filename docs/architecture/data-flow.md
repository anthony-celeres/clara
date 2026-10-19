# CLARA Data Flow — reference map + Dev Tools visualizer plan

- **Status:** Proposed (planning)
- **Purpose:** one authoritative picture of how data moves through CLARA, and the plan for an interactive Dev Tools page that renders it.
- **Grounded in:** `src/app/api/chat/route.ts`, `src/lib/{pii-scrubber,rag,crawl-sources,supabase,firebase}.ts`, `src/app/api/admin/*`, `src/proxy.ts`, `supabase/migrations/*`, ADR-001, ADR-002.

---

## Part 1 — The data-flow map (verified against code)

### Flows
1. **Chat query (core):** `/chat` → `POST /api/chat` → `scrubPII` → `detectLanguage` → (live) embed query (Gemini) → `match_doc_chunks` RPC (cosine kNN over **`active`** chunks) → relevance gate (≥0.6 else defer-to-LCRO) → ground `gemini-2.5-flash` on `verbatim_text` → stream → `/chat`; `[CHECKLIST: …]` trailer renders the checklist card. (Mock path: keyword match → seeded guide → canned stream.)
2. **Feedback / analytics:** `/chat` → `addFeedback` / `logAnalyticsEvent` (preview PII-scrubbed) → **Firestore**; admin reads via the `firebase-admin` server route.
3. **Ingestion:** structured guides (`ingest-kb.mjs`) and web sources (`/api/admin/crawl` → fetch lawphil/psahelpline → cheerio → chunk) → embed → `doc_chunks` as **`unverified`** → doc-05 review → **`active`** → retrievable by flow 1.
4. **Auth / admin gate:** login → Supabase auth (or localStorage mock) → session cookie → `proxy.ts` gates `/admin/*` + `/api/admin/*` → admin routes use the service-role key.

### Invariants the visualizer should make visible
- 🔒 **PII boundary** — `scrubPII` runs before Gemini *and* before analytics logging (RA 10173).
- 🚪 **Content gate** — only `effective_status='active'` chunks are retrievable; all ingestion lands `unverified`.
- 🔑 **Secret boundary** — Gemini key + service-role key are server-only, never in the client bundle.
- 🔁 **Mock/live seam** — each external service falls back to a mock when its env is absent.
- 🌐 **SSRF allow-list** — `/api/admin/crawl` fetches only `lawphil.net` + `psahelpline.ph`.

### Stores
Supabase/Postgres: `users, sessions, checklists, messages, guides, knowledge_base, sources, doc_chunks(pgvector)` · Firestore: `user_feedback, analytics_log` · client localForage: offline guide cache + mock DB.

---

## Part 2 — Visualizer implementation plan (React Flow)

**Dependency:** `@xyflow/react` (React Flow). **Placement:** new tab `activeTab === 'dataflow'` — a sidebar button in the Dev Tools section (beside Sandbox / Offline Data), a header title ("CLARA Data Flow"), and a `<DataFlowMap/>` tab body. Curated/static graph (not live telemetry) for the MVP.

### Node model
```ts
type FlowNodeKind = 'ui' | 'route' | 'lib' | 'store' | 'external' | 'gate';
interface FlowNode {
  id: string; label: string; kind: FlowNodeKind;
  file?: string;            // shown in the detail panel
  detail: string;           // what it does
  layers: FlowLayer[];      // which flows it participates in
  serverOnly?: boolean;     // 🔑 badge
}
type FlowLayer = 'chat' | 'ingestion' | 'feedback' | 'auth';
```

### Node catalog (MVP)
| id | label | kind | file | layers |
|---|---|---|---|---|
| chat-ui | /chat | ui | app/chat/page.tsx | chat, feedback |
| api-chat | /api/chat | route | app/api/chat/route.ts | chat |
| scrub | scrubPII | lib | lib/pii-scrubber.ts | chat, feedback |
| lang | detectLanguage | lib | lib/language-detect.ts | chat |
| embed | embedText/embedQuery | lib | lib/rag.ts | chat, ingestion |
| rpc | match_doc_chunks | store | supabase/migrations/0002 | chat |
| chunks | doc_chunks (pgvector) | store | migrations/0001 | chat, ingestion |
| gemini | Gemini (embed + 2.5-flash) | external | — | chat, ingestion |
| crawl | /api/admin/crawl | route | app/api/admin/crawl/route.ts | ingestion |
| websrc | lawphil / psahelpline | external | lib/crawl-sources.ts | ingestion |
| ingest | ingest-kb.mjs | lib | scripts/ingest-kb.mjs | ingestion |
| gate | doc-05 review (effective_status) | gate | docs/handoff/05a | ingestion |
| firestore | Firestore (feedback, analytics) | store | lib/firebase.ts | feedback |
| fbadmin | firebase-admin route | route | app/api/admin/feedback,analytics | feedback |
| login | login / register | ui | app/login, app/register | auth |
| supaauth | Supabase auth + tables | store | lib/supabase.ts | auth, chat |
| proxy | proxy.ts (admin gate) | gate | src/proxy.ts | auth |
| admin | /admin dashboard | ui | app/admin/dashboard | auth, ingestion, feedback |

### Edge catalog (label = what moves; tagged by layer)
chat: chat-ui→api-chat (message) · api-chat→scrub (raw) · scrub→lang · lang→embed · embed→gemini (query) · gemini→rpc (vector) · rpc→chunks (kNN, active only) · chunks→api-chat (verbatim) · api-chat→gemini (grounded prompt) · gemini→chat-ui (stream).
ingestion: ingest→embed · crawl→websrc (fetch) · websrc→crawl (html) · crawl→embed · embed→chunks (unverified) · chunks→gate · gate→chunks (activate).
feedback: chat-ui→firestore (write) · admin→fbadmin→firestore (read).
auth: login→supaauth · supaauth→proxy (cookie) · proxy→admin.

### Interaction / layers
- **Layer toggles** (radio or chips): All · Chat · Ingestion · Feedback · Auth — dim non-matching nodes/edges.
- **Invariant overlays** (checkboxes): PII (highlight scrub edges) · Content gate (highlight the `active`-only filter) · Server-only (badge 🔑 nodes) · Mock/Live (color seam edges).
- **Click a node** → side panel with `label`, `file` (clickable path), `detail`, and its layers. React Flow `onNodeClick`.
- Pan / zoom / minimap via React Flow defaults; `prefers-reduced-motion` respected (no auto-animation when set).

### Layout
Left→right by stage: UI → routes/libs → stores/external. Hand-place node positions (curated, readable) rather than auto-layout, since the graph is small (~18 nodes) and clarity matters more than generality.

### Phasing
- **MVP:** the curated static graph above + layer toggles + click-detail. Pure front-end, no backend, no live data — safe, my-lane.
- **Phase 2 (optional):** overlay **live state** — per-service mock/live (from a tiny `/api/admin/system-status` route), and `active`/`unverified` chunk counts on the `chunks` node (reuse `GET /api/admin/chunks`). Turns the map into a live system dashboard.

### Wiring checklist
1. `npm i @xyflow/react`.
2. New component `src/components/DataFlowMap.tsx` (nodes/edges catalogs + React Flow canvas + detail panel + layer state).
3. Dashboard: add a `dataflow` sidebar button in the Dev Tools section; add the header title; render `<DataFlowMap/>` when `activeTab === 'dataflow'`.
4. `npm run build` green; follow the visual-iteration loop (render → screenshot → look) since it's a new UI surface.

### Notes
- Brand: use the AI4GOV palette / design-system tokens for node styles (per `standards/branding.md`), not React Flow defaults.
- This is a **dev tool** (admin-only, behind the proxy) — internal, not citizen-facing.
