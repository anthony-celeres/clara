# 01 — Supabase (PostgreSQL + Auth + RLS)

Goal: stand up the real relational database + auth, run the schema and row-level security, and flip `src/lib/supabase.ts` from mock to live.

## Step 1 — Create the project

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine for the pilot). Pick an APAC region (e.g. Singapore) for latency.
2. Project Settings → API → copy the **Project URL** and **anon public** key.
3. Put them in `projects/clara/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   ```

## Step 2 — Run the schema

Supabase → SQL Editor → New query → paste and run. (Schema mirrors `../clara-psd/clara-schema.md` and `clara-psd/instruction.md §3`.)

```sql
create table users (
  user_id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  created_at timestamptz default now(),
  access_mode text,
  role text default 'community'   -- 'admin' | 'lcro' | 'community'
);

create table sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid references users(user_id),
  start_time timestamptz default now(),
  last_active timestamptz default now(),
  language text,                  -- 'eng' | 'fil' | 'vis'
  offline_mode boolean default false
);

create table checklists (
  checklist_id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(session_id),
  user_id uuid references users(user_id),
  title text not null,
  items_json jsonb not null,      -- [{ text, checked }]
  done_count int default 0,
  last_updated timestamptz default now()
);

create table messages (
  message_id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(session_id) not null,
  role text not null,             -- 'user' | 'assistant'
  message_type text default 'text', -- 'text' | 'checklist' | 'template'
  text text,
  checklist_id uuid references checklists(checklist_id),
  timestamp timestamptz default now()
);

create table knowledge_base (
  kb_id serial primary key,
  title text not null,
  category text not null,          -- 'Birth' | 'Marriage' | 'Death'
  version text,
  last_updated timestamptz default now(),
  admin_user_id int,
  is_active boolean default true
);

create table guides (
  guide_id serial primary key,
  kb_id int references knowledge_base(kb_id) not null,
  title text not null,
  steps_json jsonb,                -- [{ step_number, instruction }]
  requirements_json jsonb,         -- [string]
  fees_text text,
  tips text,
  language text not null           -- 'eng' | 'fil' | 'vis'
);

create table sources (
  source_id serial primary key,
  guide_id int references guides(guide_id) not null,
  name text not null,
  url text,
  last_updated timestamptz,
  is_primary boolean default false
);

create table user_feedback (
  feedback_id uuid primary key default gen_random_uuid(),
  user_id uuid references users(user_id),
  message_id uuid references messages(message_id),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table analytics_log (
  log_id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(session_id),
  event_type text,
  query_preview text,
  language text,
  offline_mode boolean,
  response_time_ms int,
  timestamp timestamptz default now()
);

create table personas (
  persona_id serial primary key,
  name text not null, avatar text, age int, address text,
  backstory text, problem_type text, is_active boolean default true
);
```

> **Source of truth: Firestore, not these tables.** `user_feedback` and
> `analytics_log` are written and read exclusively via Firestore (doc 02); the
> app's `supabase.ts` has no feedback/analytics path. These two SQL tables are
> vestigial — kept for now but **not** a source of truth; do not write to them.
> If this decision ever changes, update `src/lib/firebase.ts`,
> `src/lib/firebase-admin.ts`, and the admin routes.
> Decision + rationale: [`docs/dev_journal/sprintlogs/2026-06-24-feedback-analytics-source-of-truth.md`](../dev_journal/sprintlogs/2026-06-24-feedback-analytics-source-of-truth.md).

## Step 3 — Enable Row-Level Security

```sql
alter table users enable row level security;
alter table sessions enable row level security;
alter table checklists enable row level security;
alter table messages enable row level security;
alter table user_feedback enable row level security;

create policy user_self_access on users for all to authenticated
  using (auth.uid() = user_id);

create policy user_session_access on sessions for all to authenticated
  using (auth.uid() = user_id);

create policy user_checklist_access on checklists for all to authenticated
  using (auth.uid() = user_id);

create policy user_message_access on messages for all to authenticated
  using (exists (select 1 from sessions
    where sessions.session_id = messages.session_id
      and sessions.user_id = auth.uid()));

create policy user_insert_feedback on user_feedback for insert to authenticated
  with check (auth.uid() = user_id);

-- Admin read access.
-- DO NOT inline `select 1 from users where role = 'admin'` into a policy that
-- is itself ON `users`: Postgres re-applies the policy to that inner read and
-- recurses infinitely (error 42P17 "infinite recursion detected in policy").
-- The `admin_read_feedback` policy below hits it transitively too, because its
-- subquery also reads `users`.
--
-- Fix: a SECURITY DEFINER helper that runs as its owner (exempt from RLS on
-- `users`), so the role check does not re-trigger the policy. `set search_path
-- = ''` + fully-qualified names hardens it against search_path hijacking.
create or replace function public.is_admin()
  returns boolean
  language sql
  security definer
  set search_path = ''
  stable
as $$
  select exists (
    select 1 from public.users
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create policy admin_users_read on users for select to authenticated
  using (public.is_admin());

create policy admin_read_feedback on user_feedback for select to authenticated
  using (public.is_admin());
```

`guides`, `knowledge_base`, `sources` stay readable by anon (public guide content); gate **writes** behind admin in the API layer (see `/api/guides` and doc 04).

## Step 4 — Flip to live + verify the mock seam

`src/lib/supabase.ts` already switches to the real client when the keys are present (`isLiveSupabase`). Two things to verify, because the mock implemented only a **subset** of the Supabase API:

1. **Auth shape.** Real Supabase Auth returns a `User` whose role is NOT a top-level column — it lives in your `users` table (or `user_metadata`). The mock put `role` on the user object directly. Audit every `user.role` read (landing page, admin pages, `AuthContext`, the cookie shim) and fetch role from the `users` table after login instead.
2. **Query calls.** Search for `supabase.from(` and `supabase.auth.` across `src/`. Confirm each chained call (`.select().eq().single()`, `.insert()`, `.update()`, `.delete()`) behaves the same against the real client.

## Step 5 — Verify

```bash
npm run build
npm run dev
```
- Console should NOT print "Running in Supabase MOCK mode".
- Register a user → row appears in Supabase `users`. Log in on another browser → session restored.
- Create a checklist while authenticated → row in `checklists`, survives refresh.

Next: [`02-firebase.md`](02-firebase.md).
