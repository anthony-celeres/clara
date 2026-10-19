# 03 — Gemini + RAG pipeline

Goal: turn on real AI responses, and — the important part — wire retrieval to the **database** instead of the hardcoded seed data. File: `src/app/api/chat/route.ts`.

## Step 1 — Key

1. Get a key from [Google AI Studio](https://aistudio.google.com/apikey).
2. Add to `.env.local` (server-side only — note: **no** `NEXT_PUBLIC_` prefix, so it never reaches the browser):
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=<key>
   ```

Once set, `hasLiveAPI` becomes true and the route calls `google('gemini-1.5-flash')` via the Vercel AI SDK instead of the mock stream. Consider upgrading the model id to a current Gemini Flash version.

## Step 2 — The required fix: RAG from the database

Today the route retrieves guides from `GUIDES_SEED` (imported from `src/lib/seed-data.ts`) using keyword `if/else` intent matching. That's prototype behavior. For live:

1. **Query the `guides` table** (Supabase) for the matched topic + detected language, instead of `GUIDES_SEED.find(...)`.
2. Keep the language detection (`detectLanguage` / franc-min) and the `kb_id` topic mapping, but resolve the actual guide rows from the DB so admin edits in the KB manager take effect.
3. Fall back to `'fil'` when the detected language has no guide row (same as the seed logic does today).
4. Consider replacing brittle keyword matching with a retrieval step (embeddings or Postgres full-text search) once content volume grows — but keyword + category is acceptable for the pilot.

## Step 3 — Keep the guardrails (do not weaken)

- **PII first.** `scrubPII(lastUserMessage)` already runs before anything is sent to Gemini. Keep it. Never pass raw input to the model. (See doc on `/api/scrub` + `src/lib/pii-scrubber.ts`.)
- **Deterministic grounding.** The `SYSTEM_PROMPT` instructs CLARA to answer ONLY from the provided guide and to defer to the LCRO when unknown. Keep this verbatim intent. Inject the retrieved guide as the `VERIFIED GUIDELINES` block exactly as the route does now.
- **Checklist trigger.** The model emits `[CHECKLIST: Guide Title]` at the end when a guide matched; the frontend parses this to render the checklist card. Preserve that contract.

## Step 4 — Verify

```bash
npm run dev
```
- Ask "Magkano ang RA 9048 correction?" → grounded answer in Filipino, ends with `[CHECKLIST: Clerical Error Correction (RA 9048)]`.
- Edit that guide's fee in the admin KB manager → the chat answer reflects the new fee (proves RAG reads the DB, not the seed).
- Ask something out of scope → CLARA declines and points to the LCRO (grounding holds).

Next: [`04-auth-and-admin-proxy.md`](04-auth-and-admin-proxy.md).
