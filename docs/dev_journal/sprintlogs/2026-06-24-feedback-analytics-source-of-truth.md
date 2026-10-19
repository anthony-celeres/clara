# Sprintlog — Feedback / Analytics Source-of-Truth Decision

```yaml
date: 2026-06-24
component: backend-integration
lanes: frontend (PodC_Anthony) drafted · backend (PodC_Justin) owns implementation
decision_type: architecture / source-of-truth
```

## Decision

**Firestore is the single source of truth for `user_feedback` and `analytics_log`.**
The Supabase tables of the same name (doc 01) are **not** a source of truth and
must not be written to. Don't dual-write.

## Why (grounded in the code as it stands today)

The running system has already made this decision implicitly — this sprintlog
just ratifies it and makes the docs honest:

- **All writes go to Firestore.** Feedback → `firebase.ts → addFeedback` →
  Firestore `user_feedback`. Analytics → `firebase.ts → logAnalyticsEvent`
  (called from `chat/page.tsx` and the admin dashboard) → Firestore
  `analytics_log`.
- **All reads go to Firestore.** Both admin routes (`/api/admin/feedback`,
  `/api/admin/analytics`) read via `getAdminDb` from `firebase-admin`,
  server-side, behind the admin proxy.
- **Supabase has no feedback/analytics path at all.** `src/lib/supabase.ts`
  contains zero feedback/analytics code. The `user_feedback` / `analytics_log`
  tables in doc 01 are defined but unused — vestigial.

Choosing Firestore therefore costs **zero migration** and aligns with how the
two stores are already split: Supabase holds the relational core (users,
sessions, checklists, messages, guides); Firestore holds the high-write,
schema-loose event sinks (feedback, analytics). Neither table participates in an
app-level relational join, and admin read-gating is already solved server-side
in Firestore — keeping them in Supabase would mean re-solving a problem that's
already done.

## Consequences / follow-ups

1. **Vestigial Supabase tables.** `user_feedback` and `analytics_log` in doc 01
   are now explicitly *not* the source of truth. Kept (annotated) for now rather
   than dropped, to preserve optionality — backend lane's call whether to remove
   them. NOTE: if `user_feedback` is dropped, its RLS policies go too
   (`user_insert_feedback`, `admin_read_feedback`, and the `enable row level
   security` line + the `is_admin()` usage on that table).

2. **PII gap — RA 10173. ✅ RESOLVED (commit `85be215`).**
   `chat/page.tsx` logged `query_preview: input.substring(0, 50)` — the **raw,
   unscrubbed** first 50 chars of user input, while the Gemini path scrubs via
   `scrubPII`. Fixed: `query_preview` now runs through `scrubPII` *before*
   truncating (scrub-then-slice, so a TIN/phone/SSS straddling char 50 can't
   leak as a partial). Same scrubber, same guarantees as the Gemini path.

3. **Analytics is still mock-shaped even in "live" mode.** `region`/`province`
   are randomly selected from a hardcoded list and `session_id` is the literal
   `'chat-session-uuid'`. Wire these to the real session + a real geo signal
   before treating analytics data as trustworthy.

4. **Firestore rules are permissive.** `allow create: if true` on both
   collections lets anyone write arbitrary documents (spam/abuse vector).
   Acceptable for a closed demo; harden (App Check / payload validation) before
   a public pilot. `allow read: if false` is correct — admin reads use the
   service account server-side, which bypasses rules.

## Doc changes made alongside this decision

- `docs/handoff/01-supabase.md` — annotated the two tables as non-source-of-truth.
- `docs/handoff/02-firebase.md` — recorded the decision in place of the open "decide…" note.
