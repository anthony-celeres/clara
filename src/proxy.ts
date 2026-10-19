// src/proxy.ts — Next.js 16 proxy (replaces middleware.ts)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const ADMIN_ONLY_PATHS = [
  '/admin/dashboard',
  '/admin/guides',
  '/admin/feedback',
  '/admin/sandbox',
  '/admin/data',
];

const ADMIN_API_METHODS = ['POST', 'PUT', 'DELETE'];

const isLiveSupabase =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== 'your_supabase_url' &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'your_supabase_anon_key';

async function getLiveUser(
  request: NextRequest,
  response: NextResponse
): Promise<{ role: string | null } | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', user.id)
    .single();

  return { role: data?.role ?? null };
}

// MOCK mode: read the clara-mock-session cookie set by supabase.ts shim
function getMockUser(request: NextRequest): { role: string } | null {
  const cookie = request.cookies.get('clara-mock-session');
  if (!cookie) return null;
  try {
    return JSON.parse(decodeURIComponent(cookie.value));
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  let hasSession = false;
  let userRole: string | null = null;

  if (isLiveSupabase) {
    const liveUser = await getLiveUser(request, response);
    hasSession = liveUser !== null;
    userRole = liveUser?.role ?? null;
  } else {
    const mockUser = getMockUser(request);
    hasSession = mockUser !== null;
    userRole = mockUser?.role ?? null;
  }

  // ---------- Protect admin routes ----------
  if (pathname.startsWith('/admin')) {
    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (userRole !== 'admin' && userRole !== 'lcro') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (ADMIN_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      if (userRole !== 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      }
    }
  }

  // ---------- Protect API write endpoints ----------
  if (pathname.startsWith('/api/guides') || pathname.startsWith('/api/seed')) {
    if (ADMIN_API_METHODS.includes(request.method)) {
      if (!hasSession || userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden – Admin privileges required' },
          { status: 403 }
        );
      }
    }
  }

  // ---------- Protect admin read endpoints ----------
  // /api/admin/* uses the Firebase Admin SDK to read collections that
  // firestore.rules deny to clients. Gate every method to admins only.
  if (pathname.startsWith('/api/admin')) {
    if (!hasSession || userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden – Admin privileges required' },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/guides/:path*', '/api/seed/:path*'],
};
