# 00 — Mock ↔ Live Seam Map

Read this before anything else. It lists every place CLARA switches between mock and live, exactly what flips it, and what extra wiring (beyond keys) is required.

## The pattern

Each service reads env vars. If they're missing or still equal to the placeholder string, the code uses a **mock**. Provide real values in `.env.local` and the same code path goes **live**.

Create `projects/clara/.env.local` (gitignored) from this template:

```env
# Supabase (doc 01)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Google Gemini — server-side only (doc 03)
GOOGLE_GENERATIVE_AI_API_KEY=

# Firebase (doc 02)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
```

## Seam-by-seam

| # | Seam | File | What flips it | Extra wiring needed? |
|---|---|---|---|---|
| 1 | **Supabase DB + Auth** | `src/lib/supabase.ts` | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` set to real values | Run schema + RLS first (doc 01). The mock client implements a tiny subset of the Supabase query API — verify each call site works against the real client. |
| 2 | **Firebase (feedback + analytics)** | `src/lib/firebase.ts` | `NEXT_PUBLIC_FIREBASE_API_KEY` + `NEXT_PUBLIC_FIREBASE_PROJECT_ID` real | Create Firestore collections `user_feedback`, `analytics_log` (doc 02). |
| 3 | **Gemini chat** | `src/app/api/chat/route.ts` | `GOOGLE_GENERATIVE_AI_API_KEY` real (`hasLiveAPI`) | **Yes — important.** Live mode still matches guides from `GUIDES_SEED` (hardcoded), not the DB. Wire it to query the `guides` table. See doc 03. |
| 4 | **Admin auth (mock shim A)** | `src/lib/supabase.ts` → `setSessionCookie()` | n/a (mock-only) | **Remove** once real Supabase auth sets a real session cookie. Frontend added this so the admin proxy works in mock mode. |
| 5 | **Admin proxy (mock shim B)** | `src/proxy.ts` | n/a (mock-only) | Replace the hand-rolled `clara-mock-session` cookie parse with a real Supabase session check (doc 04). |
| 6 | **Knowledge-base content** | `src/lib/seed-data.ts` (`GUIDES_SEED`) | n/a | Seed data is **prototype/demo content**. Replace with verified legal content before any real-user pilot (doc 05). |

## What "done" looks like

- `.env.local` has real values; `npm run dev` console no longer prints "Running in Supabase MOCK mode".
- Sign-up/login persist in Supabase; checklists + chat history survive a refresh and a different device.
- Chat answers are grounded in the **`guides` table**, in the user's language, and refuse to invent unknown info.
- Feedback + analytics rows land in Firestore.
- The two mock shims (#4, #5) are removed and `/admin/*` is gated by real auth + role.
- Guide content is verified (doc 05) — not the seed placeholders.

> Keep mock mode working even after going live if you can (guard on env), so the UI team can keep developing without your keys.
