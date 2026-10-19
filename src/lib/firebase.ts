import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const isLiveFirebase = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== 'your_firebase_api_key' && 
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== 'your_project_id';

let db: any = null;

if (isLiveFirebase) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
    console.log("CLARA: Live Firebase integration initialized.");
  } catch (e) {
    console.error("Firebase initialization failed, falling back to mock:", e);
    db = null;
  }
}

export function getFirebaseMode(): 'live' | 'mock' {
  return db ? 'live' : 'mock';
}

// 1. Feedback Operations
export async function addFeedback(feedback: {
  user_id?: string | null;
  message_id?: string | null;
  rating: number;
  comment: string;
}) {
  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'user_feedback'), {
        ...feedback,
        created_at: new Date().toISOString()
      });
      return { id: docRef.id, error: null };
    } catch (e: any) {
      console.error("Firebase addFeedback error:", e);
      return { id: null, error: e };
    }
  } else {
    // Mock implementation
    const feedbacks = getMockItem<any[]>('clara_mock_feedback', []);
    const newFeedback = {
      feedback_id: Math.random().toString(36).substring(2, 15),
      ...feedback,
      created_at: new Date().toISOString()
    };
    feedbacks.push(newFeedback);
    setMockItem('clara_mock_feedback', feedbacks);
    return { id: newFeedback.feedback_id, error: null };
  }
}

export async function getAllFeedback(): Promise<any[]> {
  if (db) {
    // Live mode: clients can't read user_feedback (firestore.rules deny it).
    // Reads go through the admin-gated server route, which uses the Admin SDK.
    if (typeof window === 'undefined') return [];
    try {
      const res = await fetch('/api/admin/feedback');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    } catch (e) {
      console.error("getFeedback error:", e);
      return [];
    }
  } else {
    // Mock implementation
    const feedbacks = getMockItem<any[]>('clara_mock_feedback', []);
    // Seed some initial mock feedback if empty
    if (feedbacks.length === 0) {
      const seedFeedback = [
        {
          feedback_id: 'fb-1',
          user_id: 'user-1',
          rating: 5,
          comment: "Napakadali gamitin! Nalaman ko agad ang mga kailangan para sa clerical error correction ng tatay ko.",
          created_at: new Date(Date.now() - 3600000 * 2).toISOString()
        },
        {
          feedback_id: 'fb-2',
          user_id: 'user-2',
          rating: 2,
          comment: "Medyo nalito ako sa late registration requirements, pero maganda ang offline mode.",
          created_at: new Date(Date.now() - 3600000 * 5).toISOString()
        },
        {
          feedback_id: 'fb-3',
          user_id: 'user-3',
          rating: 4,
          comment: "Maayong tabang alang sa mga naay problema sa birth certificate sa Mindanao.",
          created_at: new Date(Date.now() - 3600000 * 12).toISOString()
        }
      ];
      setMockItem('clara_mock_feedback', seedFeedback);
      return seedFeedback;
    }
    return feedbacks.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
}

// 2. Analytics Log Operations
export async function logAnalyticsEvent(event: {
  session_id?: string | null;
  event_type: string;
  query_preview?: string;
  language: string;
  offline_mode: boolean;
  response_time_ms: number;
  region?: string | null;
  province?: string | null;
}) {
  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'analytics_log'), {
        ...event,
        timestamp: new Date().toISOString()
      });
      return { id: docRef.id, error: null };
    } catch (e: any) {
      console.error("Firebase logAnalyticsEvent error:", e);
      return { id: null, error: e };
    }
  } else {
    // Mock implementation
    const logs = getMockItem<any[]>('clara_mock_analytics', []);
    const newLog = {
      log_id: Math.random().toString(36).substring(2, 15),
      ...event,
      timestamp: new Date().toISOString()
    };
    logs.push(newLog);
    setMockItem('clara_mock_analytics', logs);
    return { id: newLog.log_id, error: null };
  }
}

export async function getAllAnalyticsLogs(): Promise<any[]> {
  if (db) {
    // Live mode: clients can't read analytics_log (firestore.rules deny it).
    // Reads go through the admin-gated server route, which uses the Admin SDK.
    if (typeof window === 'undefined') return [];
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    } catch (e) {
      console.error("getAnalytics error:", e);
      return [];
    }
  } else {
    // Mock implementation
    const logs = getMockItem<any[]>('clara_mock_analytics', []);
    // Seed some mock analytics if empty
    if (logs.length === 0) {
      const seedLogs = [
        { log_id: 'l-1', session_id: 's-1', event_type: 'query', query_preview: 'magkaibang birth certificate', language: 'fil', offline_mode: false, response_time_ms: 450, timestamp: new Date(Date.now() - 60000 * 5).toISOString(), region: 'National Capital Region', province: 'Manila' },
        { log_id: 'l-2', session_id: 's-1', event_type: 'query', query_preview: 'LET board exam name correction', language: 'eng', offline_mode: false, response_time_ms: 600, timestamp: new Date(Date.now() - 60000 * 4).toISOString(), region: 'CALABARZON (Region IV-A)', province: 'Batangas' },
        { log_id: 'l-3', session_id: 's-2', event_type: 'query', query_preview: 'Tboli singular names birth registry', language: 'fil', offline_mode: false, response_time_ms: 850, timestamp: new Date(Date.now() - 60000 * 20).toISOString(), region: 'Autonomous Region in Muslim Mindanao (ARMM)', province: 'Sulu' },
        { log_id: 'l-4', session_id: 's-3', event_type: 'offline_search', query_preview: 'RA 9048 Clerical', language: 'fil', offline_mode: true, response_time_ms: 5, timestamp: new Date(Date.now() - 60000 * 45).toISOString(), region: 'Central Visayas (Region VII)', province: 'Cebu' }
      ];
      setMockItem('clara_mock_analytics', seedLogs);
      return seedLogs;
    }
    return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }
}

// Helpers for localStorage in Mock Mode
function getMockItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : defaultValue;
}

function setMockItem(key: string, value: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}
