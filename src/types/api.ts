// src/types/api.ts
// Centralized type definitions for CLARA API contracts and data models

// ============================================================
// 1. Enums & Unions
// ============================================================

export type UserRole = 'admin' | 'lcro' | 'community';
export type Language = 'eng' | 'fil' | 'vis';
export type GuideCategory = 'Birth' | 'Marriage' | 'Death';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ChecklistItem = { text: string; checked: boolean };

// ============================================================
// 2. Core Data Models
// ============================================================

/** Represents a localized civic registry guide. */
export interface Guide {
  guide_id: number;
  kb_id: number;
  title: string;
  category: GuideCategory;
  steps_json: { step_number: number; instruction: string }[];
  requirements_json: string[];
  fees_text: string;
  tips: string;
  language: Language;
}

/** Test persona for demo and validation scenarios. */
export interface Persona {
  persona_id: number;
  name: string;
  avatar: string;
  age: number;
  address: string;
  backstory: string;
  problem_type: string;
  test_query: string;
  checklist_items: string[];
}

/** User profile (from Supabase). */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

/** Interactive checklist, persisted locally or on server. */
export interface Checklist {
  checklist_id: string;
  session_id: string | null;
  user_id: string | null;
  title: string;
  items_json: ChecklistItem[];
  done_count: number;
  last_updated: string;
}

/** Chat session metadata. */
export interface Session {
  session_id: string;
  user_id: string | null;
  start_time: string;
  last_active: string;
  language: Language;
  offline_mode: boolean;
}

/** Single chat message. */
export interface ChatMessageRecord {
  message_id: string;
  session_id: string;
  role: MessageRole;
  text: string | null;
  checklist_id: string | null;
  timestamp: string;
}

/** Knowledge base topic (grouping for guides). */
export interface KnowledgeBase {
  kb_id: number;
  title: string;
  category: GuideCategory;
  version: string;
  last_updated: string;
  is_active: boolean;
}

/** Citation source for a guide. */
export interface Source {
  source_id: number;
  guide_id: number;
  name: string;
  url: string | null;
  last_updated: string;
  is_primary: boolean;
}

/** User-submitted feedback. */
export interface Feedback {
  feedback_id: string;
  user_id: string | null;
  message_id: string | null;
  rating: number; // 1–5
  comment: string;
  created_at: string;
}

/** Analytics event log. */
export interface AnalyticsLog {
  log_id: string;
  session_id: string | null;
  event_type: string; // 'query', 'offline_search', 'feedback_submit', etc.
  query_preview: string | null;
  language: Language;
  offline_mode: boolean;
  response_time_ms: number;
  region: string | null;
  province: string | null;
  timestamp: string;
}

// ============================================================
// 3. API Request / Response Types
// ============================================================

// ---------- 3.1 Chat API ----------
export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

// Response is a Vercel AI SDK text stream (not JSON):
// Content-Type: text/plain; charset=utf-8
// Format: "0:{\"text\"}\n" per chunk

// ---------- 3.2 Guides CRUD API ----------

/** Payload for creating a new guide (POST /api/guides). */
export type CreateGuidePayload = Omit<Guide, 'guide_id'>;

/** Payload for updating an existing guide (PUT /api/guides). */
export type UpdateGuidePayload = Partial<CreateGuidePayload> & {
  guide_id: number;
};

/** Standard API success/error envelope (used for non-streaming endpoints). */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// GET /api/guides → ApiResponse<Guide[]>
// POST /api/guides → ApiResponse<Guide>
// PUT /api/guides → ApiResponse<Guide>
// DELETE /api/guides?id={guide_id} → ApiResponse<{ guide_id: number }>

// ---------- 3.3 PII Scrubber API ----------
export interface ScrubRequest {
  text: string;
}

export interface ScrubResponse {
  text: string; // PII redacted with [TOKEN] replacements
}

// ---------- 3.4 Feedback & Analytics (Firestore) ----------

/** Payload for submitting user feedback (addFeedback). */
export interface FeedbackPayload {
  user_id?: string | null;
  message_id?: string | null;
  rating: number; // 1–5
  comment: string;
}

/** Payload for logging an analytics event (logAnalyticsEvent). */
export interface AnalyticsPayload {
  session_id?: string | null;
  event_type: string;
  query_preview?: string;
  language: Language;
  offline_mode: boolean;
  response_time_ms: number;
  region?: string | null;
  province?: string | null;
}

// ============================================================
// 4. Auth (Supabase) – implicit contract
// ============================================================

/**
 * Login / Signup flows are handled directly by supabase.auth
 * and are not exposed as REST endpoints. However, the client
 * relies on the following expectations:
 *
 * - supabase.auth.signInWithPassword({ email, password })
 *   → returns { data: { user: { id, email, role, ... } } }
 *
 * - supabase.auth.signUp({ email, password })
 *   → returns { data: { user: { id, email, ... } } }
 *
 * - After login, the client redirects based on user.role:
 *   - 'admin' or 'lcro' → /admin/dashboard
 *   - 'community' → /chat
 *
 * - All subsequent authenticated requests include the Supabase
 *   JWT in the Authorization header (handled by the SDK).
 */

// ============================================================
// 5. Offline Cache (localForage) – implicit contract
// ============================================================

/**
 * Guides cached locally are stored under the key 'clara-guides'.
 * The cache is versioned with 'clara-kb-version'.
 *
 * Offline queue items (synced when back online) are stored under
 * 'sync-queue' and have the following shape:
 */
export interface OfflineQueueItem {
  id: string;
  type: 'feedback' | 'checklist-sync' | 'checklist-delete';
  payload: any;
  timestamp: string;
}