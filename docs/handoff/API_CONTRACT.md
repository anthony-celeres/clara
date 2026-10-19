# CLARA — Complete Project Specification

**Civil Legal and Registry Assistant**  
*Progressive Web App • AI Chatbot • Civic Document Guide*

---

## 1. Overview

CLARA (Civil Legal and Registry Assistant) is a PWA-based AI chatbot that helps Filipino citizens navigate the process of securing, correcting, or registering civil documents (birth, marriage, death certificates). It provides plain‑language guidance, interactive checklists, multilingual support (English, Filipino/Tagalog, Bisaya/Cebuano), and offline access to cached guides.

### 1.1 Problem Statement

| Aspect | Detail |
| :--- | :--- |
| **Target Context** | Coverage spanning urban HUCs and GIDA‑adjacent communities |
| **Core Problem** | Filipinos cannot efficiently process civil documents due to lack of accessible, plain‑language guidance on requirements, procedures, and the correct government offices to visit |
| **Consequences** | Multiple failed office trips, wasted transport costs, delayed benefits, blocked school enrolment, unresolved identity records for IP communities |
| **Scale** | PSA estimates 3.7–5 million Filipinos have no registered birth certificate; ~1 million late registration cases filed annually |

### 1.2 Proposed Solution

- **Platform:** Progressive Web App (installable on any device via browser)
- **Type:** AI‑powered chatbot
- **Primary Use:** Guiding users through obtaining, correcting, or registering civil documents
- **Deployment:** Public web URL — no app store required

### 1.3 Why a PWA

- One‑time or infrequent use → no permanent app install friction
- Broad device compatibility → reaches low‑income and GIDA users
- Offline capability → core content cached locally
- No app store dependency → reduces barriers
- Lightweight → lower data consumption for Piso WiFi users

---

## 2. User Access Modes

### 2.1 Public Mode (No Account)

- Accessible without registration
- Fully functional offline with downloaded cache
- General guidance on document types and processes
- Temporary client‑side checklists (IndexedDB/LocalStorage)
- Sessions are temporary; no server‑side history

### 2.2 Authenticated Mode (With Account)

- Requires registration/login via Supabase Auth
- Personalized, persistent checklists synced to server
- Full chat history saved across sessions
- Maintains conversation context
- Best experienced online

---

## 3. User Personas (Mindanao‑focused)

### Persona 1: Sharmaine C. Dalandan — Double‑Registered Student

- **Age:** 21 | **Location:** Cagayan de Oro
- **Problem:** Two conflicting birth records (CDO and Manila) with different surnames; LET board exam at risk
- **Need:** Clear guidance on cancelling duplicate records and correcting name discrepancy

### Persona 2: Vanessa A. Maralangaw — IP Student

- **Age:** 20 | **Location:** T’boli ancestral domain, South Cotabato
- **Problem:** Grandparents have traditional singular names; no school/baptismal records
- **Need:** Culturally sensitive registration pathway under IPRA (RA 8371) with alternative evidence

### Persona 3: Melanie P. Avocardo — Proxy Filer

- **Age:** 22 | **Location:** Davao City
- **Problem:** Father’s surname misspelt (“Avocado” instead of “Avocardo”); repeated LCRO trips without complete requirements
- **Need:** Verified, upfront checklist for RA 9048 clerical correction

### Admin & LCRO Roles

- **LCRO Officer:** Monitors analytics, service metrics, and system usage (read‑only for most data)
- **Admin:** Manages Knowledge Base (CRUD), runs testing sandbox, compiles offline cache, reviews feedback

---

## 4. Key Features

- **AI Conversational Assistant** – natural dialogue, step‑by‑step guidance, contextual follow‑ups
- **Multilingual Support** – auto‑detects English, Filipino, Bisaya; responds in the same language
- **Interactive Checklists** – generated per case, checkable, progress‑tracked; persist for authenticated users
- **Pre‑built Question Suggestions** – reduce intimidation for first‑time users
- **Offline Information Access** – cached guides (~5 MB) for GIDA areas
- **Theme Support** – Light, Dark, System modes
- **Admin Portal** – Knowledge Base management, feedback review, analytics, testing sandbox, offline data compilation

---

## 5. Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js (App Router), Tailwind CSS, Framer Motion, Radix UI / shadcn/ui, Lucide React |
| **PWA** | Serwist (Service Worker), Cache API, localForage (IndexedDB) |
| **Primary DB** | Supabase (PostgreSQL) with Row‑Level Security |
| **Auth** | Supabase Auth |
| **NoSQL DB** | Firebase Cloud Firestore (analytics, feedback) |
| **AI** | Vercel AI SDK, @ai‑sdk/google (Gemini 1.5 Flash) |
| **Language Detection** | franc‑min |
| **Hosting** | Vercel (Edge functions, APAC servers) |

---

## 6. Database Schema (Supabase)

### Key Tables

- `users` – user_id, email, password_hash, role (admin/lcro/community)
- `sessions` – session_id, user_id (nullable), start_time, last_active, language, offline_mode
- `messages` – message_id, session_id, role, text, checklist_id (nullable)
- `checklists` – checklist_id, session_id (nullable), user_id (nullable), title, items_json, done_count
- `knowledge_base` – kb_id, title, category, version, is_active
- `guides` – guide_id, kb_id, title, steps_json, requirements_json, fees_text, tips, language
- `sources` – source_id, guide_id, name, url
- `user_feedback` – feedback_id, user_id, message_id, rating, comment
- `analytics_log` – log_id, session_id, event_type, query_preview, language, offline_mode, response_time_ms
- `personas` – persona_id, name, avatar, age, address, backstory, problem_type, is_active

### Row‑Level Security (RLS)

- Citizens can only access their own sessions, messages, and checklists
- Admins can read all data for auditing
- LCRO officers can read analytics but not modify guides or feedback

---

## 7. API Contract (Core Routes)

All endpoints are under `/api`.

### POST `/chat`

- **Body:** `{ messages: [{ role, content }] }`
- **Response:** Vercel AI SDK text stream (`0:"chunk"`)
- **Errors:** 400 (missing messages), 500 (LLM/database failure)

### GET `/guides`

- **Returns:** Array of `Guide` objects (public read)

### POST `/guides`

- **Auth:** Admin only
- **Body:** `{ title, category, language, steps_json, requirements_json, fees_text, tips }`
- **Response:** `{ success: true, data: Guide }`

### PUT `/guides`

- **Auth:** Admin only
- **Body:** `{ guide_id, ...fields }`
- **Response:** `{ success: true, data: Guide }`

### DELETE `/guides?id={guide_id}`

- **Auth:** Admin only
- **Response:** `{ success: true, data: { guide_id } }`

### POST `/scrub`

- **Body:** `{ text: string }`
- **Response:** `{ text: string }` (PII redacted)

---

## 8. UI Design System

### Colors (CSS Custom Properties)

```css
--primary-green: #4E9C81;
--primary-light: #6AB89E;
--primary-dark: #37705C;
--background: #FFFFFF;  /* dark: #151716 */
--surface: #FFFFFF;      /* dark: #1E2120 */
--surface-highlight: #EFF2F0; /* dark: #252827 */
--text-primary: #1A1D1C; /* dark: #EFF2F0 */
--text-secondary: #707773; /* dark: #9CA5A0 */
--text-disabled: #A2AAA6; /* dark: #5B625E */
--accent-border: #E0E4E1; /* dark: #2A2E2C */
--focus-ring: #6AB89E;

### Typography

- **Font:** Inter (Google Fonts)
- **Headings:** H1 (20–24px, bold), H2 (18–20px, semibold)
- **Body:** Large (15–16px), Small (13–14px)
- **Button/Chip:** 14px, medium weight
- **Caption:** 11–12px

### Spacing (8px grid)

- 4px – label to description
- 8px – button padding, chip gaps
- 12px – same‑role bubble gap
- 16px – different‑role bubble gap, mobile container padding
- 24px – major card margins, desktop padding

### Animations

- **Message Entry:** 250ms easeOutExpo, translateY(20px) → 0, opacity 0 → 1
- **Checkbox Check:** 150ms spring (backOut), scale 0 → 1
- **Theme Icon Rotation:** 300ms easeOutExpo, rotate(360deg)
- **Offline Banner:** 250ms slideIn from top
- **Mobile Drawer:** 300ms translateY(100%) → 0

---

## 9. Interaction Specifications

### 9.1 Citizen Flows

#### Start Chat & Suggestions

- User lands on homepage, sees welcome + suggestion chips
- Tapping a chip or typing sends the message to the chatbot

#### Conversational Consultation

- User types in English, Filipino, or Bisaya
- System auto‑detects language via franc‑min
- Responds in the matched language; if unsupported, notifies the user

#### Manage Active Checklists

- Checklist rendered inline in chat after intent detection
- User taps checkbox → 150ms spring animation, label strikethrough, progress bar updates
- Public mode: saved to IndexedDB; Authenticated: synced to server

#### Browse Guides Offline

- Toggle Offline or network drop → green banner appears
- Chat hidden; offline search bar + directory cards shown
- Real‑time filtering; tapping a card opens a details modal

#### Submit Feedback

- User selects 1–5 stars and optionally comments
- Saved to server if online, or queued for later sync

### 9.2 Admin Flows

#### Login & Dashboard

- LCRO or Admin logs in via `/login`; redirected to `/admin/dashboard`
- Dashboard shows metric tiles (Total Users, Active Guides, Unresolved Feedback, Avg Latency)

#### Knowledge Base CRUD (Admin only)

- Admin can create, edit, delete guides (Birth, Marriage, Death)
- Changes are saved to Supabase and trigger offline cache version increment

#### Review Feedback (Admin only)

- Filter by low ratings (1–2 stars); view comments and associated chat logs

#### Analytics (LCRO & Admin)

- View language distribution, offline usage ratio, system latency, hot topics

#### Testing Sandbox (Admin only)

- Adjust system prompt, temperature, model version
- Test queries without affecting production logs; see debug info (cosine similarity, retrieved passages)

#### Offline Data Management (Admin only)

- View cache version and sync status
- Click "I‑update ang Offline Documents" to recompile and push fresh cache to PWAs

---

## 10. Security & Compliance (RA 10173)

### 10.1 Consent Model

Explicit consent dialog before any interaction:

> "By using CLARA, you agree that your chat queries and checklists are processed to guide your civil registration. In compliance with RA 10173, CLARA automatically sanitizes all private numbers before processing. We do not store private identification documents."

### 10.2 Citizen Rights

- **Right of Access:** Export My Data → downloads JSON of profile + checklists + sessions
- **Right to Rectification:** Users can update profile and checklist states
- **Right to Erasure:** Delete My Account → cascading hard‑delete across all tables

### 10.3 Data Retention

- Public Mode: wiped on tab close or after 24h inactivity
- Authenticated: encrypted at rest; inactive for 180 days → warning email, then archive and purge after 30 more days

### 10.4 PII Sanitisation Pipeline

Before sending to Gemini, run regex‑based redaction:

| PII Type | Regex Pattern | Replacement Token |
| :--- | :--- | :--- |
| SSS/GSIS | `\b\d{2}-\d{7}-\d\b` | `[SSS_NUMBER_REDACTED]` |
| TIN | `\b\d{3}-\d{3}-\d{3}-\d{3}\b` or `\b\d{9}\b` | `[TIN_REDACTED]` |
| PhilSys | `\b\d{4}-\d{4}-\d{4}-\d{4}\b` | `[PHIL_ID_REDACTED]` |
| DOB | `\b(0?[1-9]\|1[0-2])[/-](0?[1-9]\|[12]\d\|3[01])[/-](\d{4})\b` | `[DOB_REDACTED]` |
| Phone | `\b(09\|\+639)\d{9}\b` | `[PHONE_REDACTED]` |
| Email | `\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b` | `[EMAIL_REDACTED]` |

---

## 11. AI Chatbot Behaviour

### System Prompt (used in Gemini)
You are CLARA, a Civil Legal and Registry Assistant in the Philippines.
Your task is to guide the citizen based ONLY on the verified legal guidelines provided below.
Do not guess requirements, fees, or steps. If the information is not in the guide, state that they should consult their Local Civil Registrar (LCRO).
Respond in the same language the user is using (English, Filipino/Tagalog, or Bisaya/Cebuano).
Never claim to be a government official. Never provide legal advice. Always clarify you provide guidance only.
Use a warm, respectful, and encouraging tone. Be concise and clear — many users are first-time filers with low civic literacy.


### RAG Pipeline

1. User query → Language classifier (franc‑min) → detect `eng`/`fil`/`vis`
2. Query `guides` table for matching localized guide
3. Assemble context with system prompt + guide fields + user message
4. Send to Gemini API via Vercel AI SDK; stream response back

### Multilingual Parity

All guides must have matching step indexes and requirement arrays across the three languages to ensure consistent translation.

---

## 12. Offline Capability

- Cache all active guides into a single JSON file (`clara-guide-cache.json`, < 5MB)
- Versioned with a timestamp (e.g., `clara-kb-v1.4.2`)
- Service Worker compares local vs server version on reconnect; downloads new version in background
- Offline directory supports search and guide details modal without internet

---

## 13. Theme System

- Three‑state toggle: Light, Dark, System
- Preference stored in `localStorage` (`clara-theme-preference`)
- Applies `data-theme` attribute to `<html>`
- Listens to `prefers-color-scheme` changes when in System mode
- Icon rotates 360° on toggle

---

## 14. Testing Personas (Seed Data)

| Persona | Test Query |
| :--- | :--- |
| **Sharmaine** | "Dalawang birth certificate ako — magkaiba ang pangalan at lugar." |
| **Vanessa** | "Lolo at Lola ko T’boli, isang pangalan lang. Walang birth certificate. Paano magparehistro?" |
| **Melanie** | "Pabalik-balik ako sa LCRO para sa correction ng apelyido ng papa ko." |

---

## 15. Implementation Priorities

1. Project setup (Next.js + Tailwind + Serwist + Supabase)
2. Design system (CSS tokens, theme toggle)
3. Landing page
4. Auth flow (Login/Signup)
5. Chat interface (split‑screen desktop, single‑column mobile)
6. AI integration (Gemini + RAG + PII scrubber)
7. Interactive checklists (inline, sidebar, mobile drawer, sync)
8. Offline mode (cache, directory, search, detail modal)
9. Admin portal (dashboard, KB CRUD, feedback, analytics)
10. Polish (animations, accessibility, PWA manifest, icons)

---

## 16. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Gemini (server‑side only)
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

17. Design Principles
Clarity over completeness – give users what they need, not an information dump

Meet users where they are – support low‑literacy, low‑connectivity contexts

One trip, done right – prevent wasted LCRO visits

Language is identity – auto‑detect and respect user language

Trust through transparency – never mimic a government official

Continuity of context – maintain chat history and checklists so users never repeat themselves

18. Critical Reminders
Never hardcode PII anywhere.

Always scrub user input before sending to Gemini.

All guides must exist in 3 languages with matching indices.

Offline cache must stay under 5 MB.

All interactive elements need 44 px minimum touch targets.

Use dvh not vh for mobile viewport height.

CLARA never claims to be a government official.

Test with all 3 personas to validate different flows.

Sage Green (#4E9C81) is the brand colour – do not substitute.

Maintain glassmorphism header with backdrop-filter: blur(12px).