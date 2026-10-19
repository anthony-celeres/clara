// src/app/api/admin/chunks/reembed/route.ts
// POST { guide_id?: number } — re-embed one guide (or all if omitted) into
// doc_chunks. Admin-gated by the proxy. Makes the dashboard "Re-embed" real.
//
// New/updated chunks land effective_status 'unverified' on insert; an existing
// chunk keeps its current status (re-embedding content a reviewer already
// activated should not silently de-activate it — only the text/vector refresh).
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { composeGuideText, embedText, sha256, toVectorLiteral, EMBED_MODEL } from '@/lib/rag';

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Service role not configured' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const guideId: number | undefined = body?.guide_id;

  let q = supabaseAdmin.from('guides').select('*');
  if (guideId) q = q.eq('guide_id', guideId);
  const { data: guides, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!guides?.length) return NextResponse.json({ success: false, error: 'No matching guides' }, { status: 404 });

  let reembedded = 0;
  try {
    for (const g of guides) {
      const text = composeGuideText(g);
      const hash = sha256(text);
      const embedding = toVectorLiteral(await embedText(text, 'RETRIEVAL_DOCUMENT'));

      const { data: existing } = await supabaseAdmin
        .from('doc_chunks')
        .select('chunk_id')
        .eq('guide_id', g.guide_id)
        .eq('language', g.language)
        .maybeSingle();

      if (existing) {
        const { error: e } = await supabaseAdmin
          .from('doc_chunks')
          .update({
            chunk_title: g.title,
            verbatim_text: text,
            text_hash: hash,
            embedding,
            embed_model: EMBED_MODEL,
            updated_at: new Date().toISOString(),
          })
          .eq('chunk_id', existing.chunk_id);
        if (e) throw e;
      } else {
        const { error: e } = await supabaseAdmin.from('doc_chunks').insert({
          kb_id: g.kb_id,
          guide_id: g.guide_id,
          language: g.language,
          chunk_title: g.title,
          verbatim_text: text,
          text_hash: hash,
          effective_status: 'unverified',
          embedding,
          embed_model: EMBED_MODEL,
        });
        if (e) throw e;
      }
      reembedded++;
    }
  } catch (e: any) {
    console.error('reembed error:', e);
    return NextResponse.json({ success: false, error: e.message, reembedded }, { status: 500 });
  }

  return NextResponse.json({ success: true, reembedded });
}
