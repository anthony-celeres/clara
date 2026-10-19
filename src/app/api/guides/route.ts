// src/app/api/guides/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GUIDES_SEED } from '@/lib/seed-data';

// Import shared types
import type { Guide, CreateGuidePayload, UpdateGuidePayload, ApiResponse } from '@/types/api';
import { z } from 'zod'; // optional – for runtime validation

// Zod schemas for runtime validation (optional but recommended)
const CreateGuideSchema = z.object({
  title: z.string().min(1),
  category: z.enum(['Birth', 'Marriage', 'Death']),
  language: z.enum(['eng', 'fil', 'vis']),
  steps_json: z.array(z.object({ step_number: z.number(), instruction: z.string() })),
  requirements_json: z.array(z.string()),
  fees_text: z.string(),
  tips: z.string().optional(),
});

const UpdateGuideSchema = CreateGuideSchema.partial().extend({
  guide_id: z.number(),
});

import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Helper to get the current user's role (for API-level authorization)
async function getCurrentUserRole(req: NextRequest): Promise<string | null> {
  try {
    // 1. Check mock cookie first
    const mockCookie = req.cookies.get('clara-mock-session');
    if (mockCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(mockCookie.value));
        if (parsed?.role) return parsed.role;
      } catch {
        // ignore
      }
    }

    // 2. Check live Supabase session with request cookies
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const serverSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return req.cookies.getAll();
            },
            setAll() {},
          },
        }
      );
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (!user) return null;

      const client = supabaseAdmin || serverSupabase;
      const { data } = await client.from('users').select('role').eq('user_id', user.id).single();
      return data?.role ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// GET all guides (public read)
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse<Guide[]>>> {
  try {
    const { data, error } = await supabase.from('guides').select('*');
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    // If no guides are returned (e.g. empty mock database), seed it or return seed
    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, data: GUIDES_SEED });
    }
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error("GET Guides error:", e);
    return NextResponse.json({ success: false, error: 'Failed to retrieve guides' }, { status: 500 });
  }
}

// Helper to determine kb_id by category and ensure it exists in knowledge_base
async function resolveKbId(category: 'Birth' | 'Marriage' | 'Death', client: any): Promise<number> {
  let kbId = 101;
  if (category === 'Marriage') kbId = 104;
  else if (category === 'Death') kbId = 105;

  try {
    await client.from('knowledge_base').upsert({
      kb_id: kbId,
      title: `${category} Certificates and Registry`,
      category,
      version: '1.0',
      is_active: true
    }, { onConflict: 'kb_id' });
  } catch (e) {
    console.warn("Could not upsert knowledge_base:", e);
  }
  return kbId;
}

// POST create guide (Admin only)
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<Guide>>> {
  try {
    // ---- Role Check ----
    const role = await getCurrentUserRole(req);
    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden – Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json() as CreateGuidePayload;

    // Validate with Zod
    const parseResult = CreateGuideSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { title, category, steps_json, requirements_json, fees_text, tips, language } = parseResult.data;
    const client = supabaseAdmin || supabase;
    const kbId = await resolveKbId(category, client);

    // Note: 'category' is omitted because the guides SQL table stores category in knowledge_base
    const { data, error } = await client.from('guides').insert({
      title,
      steps_json,
      requirements_json,
      fees_text,
      tips,
      language,
      kb_id: kbId
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] || null });
  } catch (e: any) {
    console.error("POST Guides error:", e);
    return NextResponse.json({ success: false, error: 'Failed to create guide' }, { status: 500 });
  }
}

// PUT update guide (Admin only)
export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse<Guide>>> {
  try {
    // ---- Role Check ----
    const role = await getCurrentUserRole(req);
    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden – Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await req.json() as UpdateGuidePayload;

    // Validate with Zod
    const parseResult = UpdateGuideSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: parseResult.error.issues.map(i => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { guide_id, title, category, steps_json, requirements_json, fees_text, tips, language } = parseResult.data;

    if (!guide_id) {
      return NextResponse.json({ success: false, error: 'Guide ID is required' }, { status: 400 });
    }

    const client = supabaseAdmin || supabase;

    // Ensure kb_id is updated if category changed
    const updatePayload: Record<string, any> = {
      title,
      steps_json,
      requirements_json,
      fees_text,
      tips,
      language
    };

    if (category) {
      updatePayload.kb_id = await resolveKbId(category, client);
    }

    const { data, error } = await client
      .from('guides')
      .update(updatePayload)
      .eq('guide_id', guide_id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data?.[0] || null });
  } catch (e: any) {
    console.error("PUT Guides error:", e);
    return NextResponse.json({ success: false, error: 'Failed to update guide' }, { status: 500 });
  }
}

// DELETE guide (Admin only)
export async function DELETE(req: NextRequest): Promise<NextResponse<ApiResponse<{ guide_id: number }>>> {
  try {
    // ---- Role Check ----
    const role = await getCurrentUserRole(req);
    if (role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden – Admin privileges required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Guide ID is required' }, { status: 400 });
    }

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      return NextResponse.json({ success: false, error: 'Invalid guide ID' }, { status: 400 });
    }

    const client = supabaseAdmin || supabase;
    const { data, error } = await client
      .from('guides')
      .delete()
      .eq('guide_id', parsedId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { guide_id: parsedId } });
  } catch (e: any) {
    console.error("DELETE Guides error:", e);
    return NextResponse.json({ success: false, error: 'Failed to delete guide' }, { status: 500 });
  }
}