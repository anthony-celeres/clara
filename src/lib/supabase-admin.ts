// src/lib/supabase-admin.ts
// Server-only Supabase client using the service-role key (bypasses RLS).
// NEVER import this into a client component. Used by admin API routes that
// write KB content / embeddings behind the /api/admin/* proxy gate.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only — NO NEXT_PUBLIC_ prefix

export const supabaseAdmin =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;
