# CLARA — Project Instructions (Claude Code co-manager)

CLARA (Civil Legal and Registry Assistant) is a PWA AI chatbot that gives Filipino citizens plain-language guidance for civil-document processes (birth/marriage/death certificates, late registration, RA 9048 corrections, IPRA RA 8371). Part of the AI4GOV fellowship (cohort 2026-Q3).

> **Read [`AGENTS.md`](AGENTS.md) first.** This is Next.js 16 + React 19 + Tailwind v4 — conventions differ from older training data. When unsure, read `node_modules/next/dist/docs/`.
>
> **For any UI/design work, read [`DESIGN.md`](DESIGN.md)** — CLARA's brand profile and house-style (calm civic-trust soft-flat: palette, elevation model, affordances, motion budget, a11y floor). It's the `our-frontend-design` product-register reference for this app; don't guess design tokens.

## Two-developer split

| Lane | Owner | Scope |
|---|---|---|
| **Frontend / UI** | `fellow/PodC_Anthony` | All UI, design system, pages, components, PWA shell, mock-mode wiring |
| **Backend** | `fellow/PodC_Justin` | Supabase (schema, RLS, auth), Firebase (analytics/feedback), Gemini RAG, PII scrubbing, going mock → live |

Justin's complete, CC-actionable instructions live in [`docs/handoff/`](docs/handoff/). Start there: [`docs/handoff/README.md`](docs/handoff/README.md).

## How it runs today: MOCK mode

The app **builds and runs with zero backend keys.** Every external service detects missing/placeholder env vars and falls back to a local mock:

- `src/lib/supabase.ts` → localStorage-backed mock DB + auth (seeded default logins, e.g. `admin@clara.gov` / `admin123`)
- `src/lib/firebase.ts` → mock feedback + analytics (seeded)
- `src/app/api/chat/route.ts` → simulated streamed responses (no Gemini)

This lets the UI be built and demoed standalone. Going live = providing real keys + a few wiring fixes (see handoff). Two mock-only shims exist so the UI is fully usable without a backend — both are labelled in-code and listed in [`docs/handoff/00-mock-to-live-map.md`](docs/handoff/00-mock-to-live-map.md):
1. `src/lib/supabase.ts` mirrors the mock session into a `clara-mock-session` cookie so the admin proxy works.
2. `src/proxy.ts` decodes that cookie to gate `/admin/*`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 · Framer Motion · Lucide · TanStack Query · localForage · Supabase · Firebase Firestore · Vercel AI SDK + `@ai-sdk/google` (Gemini) · franc-min.

## Verification gate (run before declaring work done)

```bash
npm run build      # must pass — TypeScript + lint + route generation
npm run lint
```

UI changes also follow the AI4GOV **visual-iteration loop**: render the page, screenshot it, look at it before calling it done.

## Standards that bind this project

CLARA dispenses guidance citizens act on, and handles sensitive personal data, so these are non-negotiable:

- **Deterministic grounding** — the assistant answers ONLY from verified guide content; never invents requirements, fees, or steps. If unknown, it tells the user to consult their LCRO. (See the system prompt in `src/app/api/chat/route.ts`.)
- **Data privacy (RA 10173)** — PII is scrubbed from user input *before* it reaches Gemini (`src/lib/pii-scrubber.ts` + `/api/scrub`); no private ID documents are stored; RLS isolates user data; consent dialog gates first use.
- **Knowledge-base content integrity** — guide content must trace to verified legal sources before any real-user pilot. See [`docs/handoff/05-knowledge-base-content.md`](docs/handoff/05-knowledge-base-content.md).
- **Offline-first** — core guides cached under 5 MB; the app stays useful in GIDA / low-connectivity contexts.

## Layout

- `src/app/` — routes (landing, login, register, chat, offline, admin/*, api/*) + `proxy.ts` middleware
- `src/components/` — UI components · `src/hooks/` — theme/offline/checklist · `src/contexts/` — auth
- `src/lib/` — supabase, firebase, gemini-adjacent helpers, pii-scrubber, language-detect, offline-cache, seed-data
- `src/types/` — shared API types · `docs/handoff/` — backend handoff · `docs/dev_journal/` — sprintlogs + retros

## Sources of truth

- Product specs: `../clara-psd/` (project description, schema, security, UI specs, instruction.md)
- Backend contract: [`docs/handoff/API_CONTRACT.md`](docs/handoff/API_CONTRACT.md)
