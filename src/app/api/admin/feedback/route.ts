// src/app/api/admin/feedback/route.ts
// Admin-only read of user_feedback. Access is gated by src/proxy.ts (admin role
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
    const snap = await adminDb.collection('user_feedback').orderBy('created_at', 'desc').get();
    const data = snap.docs.map((d) => ({ feedback_id: d.id, ...d.data() }));
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('GET admin feedback error:', e);
    return NextResponse.json(
      { success: false, error: 'Failed to read feedback', data: [] },
      { status: 500 }
    );
  }
}
