// src/app/api/admin/chunks/route.ts
// GET — real state of the vector index (doc_chunks). Admin-gated by the proxy
// (/api/admin/*). Replaces the dashboard's fabricated embedding/pgvector text.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { EMBED_MODEL, EMBED_DIM } from '@/lib/rag';

export async function GET(): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { success: false, error: 'Service role not configured', data: [] },
      { status: 503 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from('doc_chunks')
    .select('chunk_id, guide_id, kb_id, language, chunk_title, effective_status, embed_model, updated_at')
    .order('kb_id', { ascending: true })
    .order('language', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    meta: { embed_model: EMBED_MODEL, dim: EMBED_DIM, total: data.length },
    data,
  });
}
