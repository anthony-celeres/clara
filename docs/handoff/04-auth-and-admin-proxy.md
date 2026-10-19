# 04 — Real auth + admin route protection

Goal: replace the two **mock-only shims** the frontend added (so the admin UI was viewable without a backend) with real Supabase session auth. Files: `src/proxy.ts`, `src/lib/supabase.ts`, `src/contexts/AuthContext.tsx`.

## Background: why the shims exist

`src/proxy.ts` (Next 16 middleware) gates `/admin/*` and `/api/guides` writes on a session. In the prototype, mock auth saved the session to `localStorage` (`clara_mock_session`), which middleware can't read. So the frontend added:

- **Shim A** — `src/lib/supabase.ts` → `setSessionCookie()` mirrors the mock session into a `clara-mock-session` cookie on sign-in/up/out.
- **Shim B** — `src/proxy.ts` → `getUser()` decodes that cookie and reads `role`.

Both are clearly commented `MOCK mode`. They make `/admin/*` reachable so the admin UI can be demoed. **Remove them when real auth lands.**

## Step 1 — Real session in the proxy

Use Supabase SSR session cookies instead of the hand-rolled cookie:

1. Add `@supabase/ssr` and create a server client that reads the request cookies.
2. In `proxy.ts`, replace the `clara-mock-session` parse with `supabase.auth.getUser()` (server client) to get the authenticated user.
3. Fetch the user's `role` from the `users` table (role is not on the auth user — see doc 01 Step 4).
4. Keep the same authorization logic: `/admin/*` requires role `admin` or `lcro`; admin-only paths (`ADMIN_ONLY_PATHS`) require `admin`; `/api/guides` + `/api/seed` writes require `admin`.

## Step 2 — Remove the shims

- Delete `setSessionCookie` and its calls in `src/lib/supabase.ts` (mock client).
- Delete the `clara-mock-session` cookie handling in `src/proxy.ts`.
- In `src/contexts/AuthContext.tsx`, the real Supabase client's `onAuthStateChange` already drives `user`; confirm it reflects login/logout without the mock helpers.

> If you want mock mode to keep working for the UI team, guard the shims behind `getSupabaseMode() === 'mock'` rather than deleting them outright, and use real SSR auth only when `getSupabaseMode() === 'live'`.

## Step 3 — Roles

Set a user's role in the `users` table (`admin` / `lcro` / `community`). The mock auto-assigned roles by email substring (`admin@…` → admin); in live, assign roles deliberately (a column default of `community`, promoted manually or via an admin tool).

## Step 4 — Verify

- Logged out → visiting `/admin/dashboard` redirects to `/login`.
- `community` user → cannot reach `/admin/*`.
- `lcro` user → reaches dashboard + analytics, but not KB write actions.
- `admin` user → full access; can POST/PUT/DELETE `/api/guides`.
- `npm run build` green.

Next: [`05-knowledge-base-content.md`](05-knowledge-base-content.md).
