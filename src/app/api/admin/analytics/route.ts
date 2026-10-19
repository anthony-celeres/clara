// src/app/api/admin/analytics/route.ts
// Admin-only read of analytics_log. Access is gated by src/proxy.ts (admin role
// required for any /api/admin/* path); the data itself is read with the Firebase
// Admin SDK because firestore.rules deny all client reads.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(): Promise<NextResponse> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json(
      {
        success: false,
        error: 'Firebase Admin not configured — set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local.',
        data: [],
      },
      { status: 503 }
    );
  }

  try {
    const snap = await adminDb.collection('analytics_log').orderBy('timestamp', 'desc').get();
    const data = snap.docs.map((d) => ({ log_id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('GET admin analytics error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to read analytics', data: [] },
      { status: 500 }
    );
  }
}
