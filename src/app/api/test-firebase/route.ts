import { addFeedback, getAllFeedback, getFirebaseMode } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export async function GET() {
  const mode = getFirebaseMode();

  const result = await addFeedback({
    rating: 5,
    comment: 'Test feedback from Firebase setup!',
  });

  const feedbacks = await getAllFeedback();

  return NextResponse.json({
    mode,
    addResult: result,
    feedbackCount: feedbacks.length,
    message:
      mode === 'live'
        ? '✅ Firebase is live! Check Firestore for the test document.'
        : '⚠️ Firebase is in mock mode. Check your .env.local variables.',
  });
}