// src/lib/firebase-admin.ts
// Server-only Firebase Admin SDK initializer.
//
// The browser CANNOT read user_feedback / analytics_log: firestore.rules keep
// `allow read: if false` so no client (or leaked anon key) can pull the whole
// collection. Privileged reads happen here, server-side, behind the admin proxy
// gate (see src/proxy.ts → /api/admin/*).
//
// Requires a service-account credential in FIREBASE_SERVICE_ACCOUNT_KEY (the full
// service-account JSON, as a single-line string). Without it this returns null and
// the admin read routes degrade to an empty list — the app still runs.

import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let adminDb: Firestore | null = null;
let initAttempted = false;

function init(): Firestore | null {
  if (initAttempted) return adminDb;
  initAttempted = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw || raw === 'your_firebase_service_account_json') {
    return null;
  }

  try {
    const serviceAccount = JSON.parse(raw);
    // Env vars flatten real newlines in the PEM private key to the literal "\n".
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }

    const app: App =
      getApps().length === 0
        ? initializeApp({ credential: cert(serviceAccount) })
        : getApps()[0];

    adminDb = getFirestore(app);
    console.log('CLARA: Firebase Admin initialized.');
    return adminDb;
  } catch (e) {
    console.error('Firebase Admin init failed (check FIREBASE_SERVICE_ACCOUNT_KEY JSON):', e);
    return null;
  }
}

/** Returns the Admin Firestore instance, or null if no service account is configured. */
export function getAdminDb(): Firestore | null {
  return init();
}
