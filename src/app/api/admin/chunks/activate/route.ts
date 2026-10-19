// src/app/api/admin/chunks/activate/route.ts
// POST { chunk_id?, guide_id?, all?, status } — set effective_status on chunks.
// This is the content-gate control: only 'active' chunks are retrievable
// (handoff doc 05). Admin-gated by the proxy.
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VALID = ['active', 'unverified', 'ocr_unreviewed'];

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Service role not configured' }, { status: 503 });
  }

  const { chunk_id, guide_id, all, status } = await req.json().catch(() => ({}));
  if (!VALID.includes(status)) {
    return NextResponse.json({ success: false, error: `status must be one of ${VALID.join(', ')}` }, { status: 400 });
  }
  if (!chunk_id && !guide_id && !all) {
    return NextResponse.json({ success: false, error: 'Specify chunk_id, guide_id, or all:true' }, { status: 400 });
  }

  let q = supabaseAdmin
    .from('doc_chunks')
    .update({ effective_status: status, updated_at: new Date().toISOString() });

  if (chunk_id) q = q.eq('chunk_id', chunk_id);
  else if (guide_id) q = q.eq('guide_id', guide_id);
  // else: all — no filter; update every chunk

  const { data, error } = await q.select('chunk_id');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, updated: data.length, status });
}
