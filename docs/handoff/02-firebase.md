# 02 — Firebase (Firestore: feedback + analytics)

Goal: stand up Firestore and flip `src/lib/firebase.ts` from mock to live. Firebase holds the high-write, unstructured data: `user_feedback` and `analytics_log`.

## Step 1 — Create the project

1. [console.firebase.google.com](https://console.firebase.google.com) → Add project.
2. Build → Firestore Database → Create database → start in **production mode**, APAC region.
3. Project Settings → General → Your apps → Web app → copy the config values.
4. Add to `projects/clara/.env.local`:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=<apiKey>
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=<projectId>
   ```

## Step 2 — Collections

The code calls these collections (`src/lib/firebase.ts`):
- `user_feedback` — `{ user_id, message_id, rating, comment, created_at }`
- `analytics_log` — `{ session_id, event_type, query_preview, language, offline_mode, response_time_ms, region, province, timestamp }`

Firestore creates collections on first write, so no manual setup is needed — but add **security rules** before any real users. Minimum: allow `create` on both collections from the app, restrict `read` to admins (via Firebase Auth custom claims or a server route). Draft the rules in the Firebase console → Firestore → Rules and record them in a sprintlog.

## Step 3 — Flip to live + verify

`src/lib/firebase.ts` switches automatically when `isLiveFirebase` is true (real `apiKey` + `projectId`). The functions already have live + mock branches:
- `addFeedback`, `getAllFeedback`
- `logAnalyticsEvent`, `getAllAnalyticsLogs`

## Step 4 — Verify

```bash
npm run dev
```
- Submit feedback in the app → a document appears in Firestore `user_feedback`.
- Send a chat query → an `analytics_log` document appears.
- Admin dashboard feedback/analytics views read from Firestore (no longer the seeded mock rows).

> **Decided: Firestore is the single source of truth** for feedback/analytics
> (the Supabase tables in doc 01 are vestigial — don't dual-write). Rationale +
> follow-ups (incl. a raw-`query_preview` PII gap to close before pilot):
> [`docs/dev_journal/sprintlogs/2026-06-24-feedback-analytics-source-of-truth.md`](../dev_journal/sprintlogs/2026-06-24-feedback-analytics-source-of-truth.md).

Next: [`03-gemini-rag.md`](03-gemini-rag.md).
