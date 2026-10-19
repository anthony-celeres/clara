# Sprintlog — Doc 02 Firebase (2026-06-23)

## What was done
- Created Firebase project `clara-ai4gov-aidev-23508` (no Google Analytics, Standard edition, asia-southeast1 / Singapore)
- Created Firestore database in production mode
- Added Web app to project; copied SDK config values into `projects/clara/.env.local`
- Confirmed `isLiveFirebase` flag activates on build: `CLARA: Live Firebase integration initialized.`
- No code changes to `src/lib/firebase.ts` — live/mock branching was already wired

## Firestore security rules (published 2026-06-23)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /user_feedback/{doc} {
      allow create: if true;
      allow read: if false;
    }
    match /analytics_log/{doc} {
      allow create: if true;
      allow read: if false;
    }
  }
}
```

Rationale: app writes feedback and analytics directly from the client; reads go through server routes only (`getAllFeedback`, `getAllAnalyticsLogs` called from admin dashboard server-side).

## Source of truth decision
Firestore is the single source of truth for `user_feedback` and `analytics_log`. The Supabase schema (Doc 01) does not duplicate these collections. Admin dashboard reads both from Firestore.

## Next
Doc 03 — Gemini RAG (`docs/handoff/03-gemini-rag.md`). Needs `GOOGLE_GENERATIVE_AI_API_KEY`.
