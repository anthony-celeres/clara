-- 0000_clara_core_schema.sql
-- Complete robust schema for CLARA (Civil Legal Registry Assistant)
-- Sets up extensions, core tables, triggers, indexes, RLS, and zero-cost search functions.

-- 1. EXTENSIONS ----------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "vector";

-- 2. USERS & AUTH --------------------------------------------------------------
-- Public profiles mirroring auth.users
create table if not exists public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'community' check (role in ('admin', 'lcro', 'community')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backward compatibility: add generated id column if queried as .eq('id', ...)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'id'
  ) then
    alter table public.users add column id uuid generated always as (user_id) stored;
  end if;
end $$;

-- Helper security definer function for role checks in RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.users
    where user_id = auth.uid()
      and role in ('admin', 'lcro')
  );
$$;

-- Automatic user registration trigger from auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (user_id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'role', 'community')
  )
  on conflict (user_id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users RLS
alter table public.users enable row level security;

drop policy if exists "Users can view their own profile or admins view all" on public.users;
create policy "Users can view their own profile or admins view all"
  on public.users for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can insert their own profile" on public.users;
create policy "Users can insert their own profile"
  on public.users for insert
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "Users can delete their own profile or admin delete" on public.users;
create policy "Users can delete their own profile or admin delete"
  on public.users for delete
  using (auth.uid() = user_id or public.is_admin());

-- 3. KNOWLEDGE BASE & CIVIC GUIDES ---------------------------------------------
create table if not exists public.knowledge_base (
  kb_id int primary key,
  title text not null,
  category text not null check (category in ('Birth', 'Marriage', 'Death')),
  version text not null default '1.0',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_updated timestamptz not null default now()
);

create table if not exists public.guides (
  guide_id serial primary key,
  kb_id int not null references public.knowledge_base(kb_id) on delete cascade,
  title text not null,
  category text check (category in ('Birth', 'Marriage', 'Death')),
  steps_json jsonb not null default '[]'::jsonb,
  requirements_json jsonb not null default '[]'::jsonb,
  fees_text text default '',
  tips text default '',
  language text not null check (language in ('eng', 'fil', 'vis')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigram index for ultra-fast fuzzy title search without AI embedding costs
create index if not exists guides_trgm_title_idx on public.guides using gin (title gin_trgm_ops);
create index if not exists guides_kb_lang_idx on public.guides (kb_id, language);

-- Sources / Citations
create table if not exists public.sources (
  source_id serial primary key,
  guide_id int references public.guides(guide_id) on delete cascade,
  name text not null,
  url text,
  is_primary boolean not null default true,
  last_updated timestamptz not null default now()
);

-- Personas (for demo, testing, and evaluation scenarios)
create table if not exists public.personas (
  persona_id serial primary key,
  name text not null,
  avatar text default '',
  age int,
  address text default '',
  backstory text default '',
  problem_type text default '',
  test_query text default '',
  checklist_items jsonb default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Public Read RLS for Knowledge Base, Guides, Sources, Personas
alter table public.knowledge_base enable row level security;
alter table public.guides enable row level security;
alter table public.sources enable row level security;
alter table public.personas enable row level security;

-- Knowledge Base policies
drop policy if exists "KB public read" on public.knowledge_base;
create policy "KB public read" on public.knowledge_base
  for select using (is_active = true or public.is_admin());

drop policy if exists "KB admin write" on public.knowledge_base;
create policy "KB admin write" on public.knowledge_base
  for all using (public.is_admin()) with check (public.is_admin());

-- Guides policies
drop policy if exists "Guides public read" on public.guides;
create policy "Guides public read" on public.guides
  for select using (true);

drop policy if exists "Guides admin write" on public.guides;
create policy "Guides admin write" on public.guides
  for all using (public.is_admin()) with check (public.is_admin());

-- Sources policies
drop policy if exists "Sources public read" on public.sources;
create policy "Sources public read" on public.sources
  for select using (true);

drop policy if exists "Sources admin write" on public.sources;
create policy "Sources admin write" on public.sources
  for all using (public.is_admin()) with check (public.is_admin());

-- Personas policies
drop policy if exists "Personas public read" on public.personas;
create policy "Personas public read" on public.personas
  for select using (is_active = true or public.is_admin());

drop policy if exists "Personas admin write" on public.personas;
create policy "Personas admin write" on public.personas
  for all using (public.is_admin()) with check (public.is_admin());

-- 4. SESSIONS, MESSAGES & INTERACTIVE CHECKLISTS -------------------------------
create table if not exists public.sessions (
  session_id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(user_id) on delete cascade,
  start_time timestamptz not null default now(),
  last_active timestamptz not null default now(),
  language text not null default 'fil' check (language in ('eng', 'fil', 'vis')),
  offline_mode boolean not null default false
);

create table if not exists public.messages (
  message_id text primary key default gen_random_uuid()::text,
  session_id text references public.sessions(session_id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  text text,
  checklist_id text,
  timestamp timestamptz not null default now()
);

create table if not exists public.checklists (
  checklist_id text primary key default gen_random_uuid()::text,
  session_id text references public.sessions(session_id) on delete set null,
  user_id uuid references public.users(user_id) on delete cascade,
  title text not null,
  items_json jsonb not null default '[]'::jsonb,
  done_count int not null default 0,
  last_updated timestamptz not null default now()
);

alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.checklists enable row level security;

-- Sessions policies (accessible by owner or if anonymous)
drop policy if exists "Sessions access policy" on public.sessions;
create policy "Sessions access policy" on public.sessions
  for all using (auth.uid() = user_id or user_id is null);

-- Messages policies
drop policy if exists "Messages access policy" on public.messages;
create policy "Messages access policy" on public.messages
  for all using (true);

-- Checklists policies
drop policy if exists "Checklists select" on public.checklists;
create policy "Checklists select" on public.checklists
  for select using (auth.uid() = user_id or user_id is null);

drop policy if exists "Checklists insert" on public.checklists;
create policy "Checklists insert" on public.checklists
  for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Checklists update" on public.checklists;
create policy "Checklists update" on public.checklists
  for update using (auth.uid() = user_id or user_id is null)
  with check (auth.uid() = user_id or user_id is null);

drop policy if exists "Checklists delete" on public.checklists;
create policy "Checklists delete" on public.checklists
  for delete using (auth.uid() = user_id or user_id is null);

-- 5. FEEDBACK & ANALYTICS ------------------------------------------------------
create table if not exists public.user_feedback (
  feedback_id text primary key default gen_random_uuid()::text,
  user_id uuid references public.users(user_id) on delete set null,
  message_id text,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_log (
  log_id text primary key default gen_random_uuid()::text,
  session_id text,
  event_type text not null,
  query_preview text,
  language text check (language in ('eng', 'fil', 'vis')),
  offline_mode boolean default false,
  response_time_ms int default 0,
  region text,
  province text,
  timestamp timestamptz not null default now()
);

alter table public.user_feedback enable row level security;
alter table public.analytics_log enable row level security;

drop policy if exists "Feedback insert policy" on public.user_feedback;
create policy "Feedback insert policy" on public.user_feedback
  for insert with check (true);

drop policy if exists "Feedback view policy" on public.user_feedback;
create policy "Feedback view policy" on public.user_feedback
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "Analytics insert policy" on public.analytics_log;
create policy "Analytics insert policy" on public.analytics_log
  for insert with check (true);

drop policy if exists "Analytics view policy" on public.analytics_log;
create policy "Analytics view policy" on public.analytics_log
  for select using (public.is_admin());

-- 6. ZERO-COST SEARCH RPC ------------------------------------------------------
-- Full-text + Trigram similarity search across guides without embedding API costs
create or replace function public.search_civic_content(
  search_query text,
  target_lang text default null,
  limit_count int default 5
)
returns table (
  guide_id int,
  kb_id int,
  title text,
  language text,
  similarity float,
  match_source text
)
language sql
stable
as $$
  select
    g.guide_id,
    g.kb_id,
    g.title,
    g.language,
    similarity(g.title, search_query) as similarity,
    'guide' as match_source
  from public.guides g
  where (target_lang is null or g.language = target_lang)
    and (
      g.title % search_query
      or g.title ilike '%' || search_query || '%'
      or exists (
        select 1 from jsonb_array_elements_text(g.requirements_json) req
        where req ilike '%' || search_query || '%'
      )
    )
  order by similarity desc
  limit limit_count;
$$;

grant execute on function public.search_civic_content(text, text, int) to anon, authenticated;
