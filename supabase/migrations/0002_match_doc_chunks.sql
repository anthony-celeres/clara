-- 0002_match_doc_chunks.sql
-- Step 3 of ADR-001: cosine kNN retrieval function for the chat route.
--
-- The supabase-js client can't express the pgvector `<=>` operator, so retrieval
-- goes through this RPC: supabase.rpc('match_doc_chunks', { ... }).
--
-- Apply in Supabase → SQL Editor. Safe to re-run (create or replace).

create or replace function match_doc_chunks(
  query_embedding vector(768),
  match_language  text,
  match_count     int default 5
)
returns table (
  chunk_id      bigint,
  guide_id      int,
  kb_id         int,
  source_id     int,
  language      text,
  chunk_title   text,
  verbatim_text text,
  similarity    float
)
language sql
stable
as $$
  select
    chunk_id,
    guide_id,
    kb_id,
    source_id,
    language,
    chunk_title,
    verbatim_text,
    1 - (embedding <=> query_embedding) as similarity   -- cosine similarity
  from doc_chunks
  where effective_status = 'active'                      -- only reviewer-activated chunks
    and language = match_language
  order by embedding <=> query_embedding                 -- nearest first
  limit match_count;
$$;

-- Callable by the app roles (anon/authenticated). The function is SECURITY
-- INVOKER by default; the only rows it can see are those RLS already exposes
-- (effective_status = 'active'), so this does not widen access.
grant execute on function match_doc_chunks(vector, text, int) to anon, authenticated;
