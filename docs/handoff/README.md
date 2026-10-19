# CLARA Backend Handoff — for Justin (fellow/PodC_Justin)

This folder is the complete, step-by-step guide for taking CLARA from **mock mode** (what the frontend ships today) to a **live backend**. It's written to be fed to your Claude Code instance more or less directly — each doc is a self-contained task with exact files, commands, SQL, and verification steps.

## How to use this with your CC

1. Get the latest frontend: `git fetch origin && git checkout fellow/PodC_Anthony -- projects/clara` (or merge/branch from it — coordinate with Anthony).
2. Open this folder. Work the docs **in order** (00 → 05).
3. For each doc, hand the file to your CC and say: *"Do this task in `projects/clara`. After, run `npm run build` and confirm green."*
4. Keep your work on `fellow/PodC_Justin`; commit small and often (see the cautionary note at the bottom).

## The core idea

The whole app already runs in **mock mode** with no keys. Every service checks for real env vars and falls back to a localStorage/simulated mock. Your job is to **provide real services + flip each seam to live**, then fix the few places that need real wiring (not just keys).

| # | Doc | What you'll do |
|---|---|---|
| 00 | [`00-mock-to-live-map.md`](00-mock-to-live-map.md) | **Read first.** The map of every mock↔live seam and what flips each one. |
| 01 | [`01-supabase.md`](01-supabase.md) | Create the Supabase project, run the schema + RLS, set keys, flip auth + DB to live. |
| 02 | [`02-firebase.md`](02-firebase.md) | Create the Firebase project + Firestore, set keys, flip feedback + analytics to live. |
| 03 | [`03-gemini-rag.md`](03-gemini-rag.md) | Set the Gemini key, and wire the chat RAG to the **database** (today it reads seed data). |
| 04 | [`04-auth-and-admin-proxy.md`](04-auth-and-admin-proxy.md) | Replace the two mock auth shims with real Supabase session auth in the proxy. |
| 05 | [`05-knowledge-base-content.md`](05-knowledge-base-content.md) | The hard gate: real, verified legal content before any real-user pilot. |
| 06 | [`06-web-ingestion-handoff.md`](06-web-ingestion-handoff.md) | Web ingestion backend handoff — pin the `sources` schema, wire `source_id` provenance, extend the content gate to scraped chunks. |

Reference: [`API_CONTRACT.md`](API_CONTRACT.md) — the full route + schema + behavior contract.

## Ground rules (non-negotiable)

- **Never** send raw user input to Gemini — it must pass through `scrubPII` first (RA 10173).
- The assistant answers **only** from verified guide content (deterministic grounding). Don't loosen the system prompt.
- **No secrets in git.** All keys go in `.env.local` (already gitignored). Never commit `.env*`.
- Run `npm run build` after every doc; it must stay green.
