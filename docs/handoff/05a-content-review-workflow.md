# 05a — Content Review Workflow (operationalizing the doc-05 gate)

Doc 05 says *what* the gate is ("verified content before any real-user pilot")
and *who* signs off (a civil-registry domain reviewer). This doc is the *how*:
the concrete process that turns a reviewer's sign-off into activated, retrievable
content — and refuses activation without it.

Audience: the build lanes (PodC_Anthony / PodC_Justin) and their CCs. The
reviewer themselves only ever touches [`05b-review-worksheets.md`](05b-review-worksheets.md) —
they never see SQL, chunks, or this file.

---

## The enforcement point (already built)

Retrieval is gated on **one field**: `doc_chunks.effective_status`. The chat RAG
only retrieves chunks where `effective_status = 'active'` (`src/lib/rag.ts` +
`/api/chat`). Valid states (`/api/admin/chunks/activate`):

| status | meaning | retrievable? |
|---|---|---|
| `active` | reviewer-verified, cleared for citizens | ✅ yes |
| `unverified` | ingested but not yet domain-reviewed | ❌ no |
| `ocr_unreviewed` | extracted from a PDF, OCR not yet checked | ❌ no |

So the gate is **already real in code**. What's missing is the human process that
decides when a chunk has earned `active`. That's this workflow.

> ⚠️ **Current state is demo, not verified.** The 9 seed chunks were flipped to
> `active` for the internal demo. That is fine for demos but it means the gate is
> currently *open on unverified content*. Before any real-user pilot, run the
> **Reset** step below so nothing is `active` until a reviewer signs it.

---

## Roles

| Role | Who | Does |
|---|---|---|
| **Coordinator** | a build lane + CC | Prepares worksheets, runs Reset/Activate, records sign-off. Never judges legal accuracy. |
| **Domain reviewer** | LCRO contact / civil-registry advisor | Verifies every claim against primary law. Signs (or rejects) per guide. The *only* person who authorizes `active`. |

The split is deliberate: the people who can run the SQL cannot vouch for the law,
and the person who can vouch for the law should not have to run SQL.

---

## The five-stage flow

```
  (0) RESET ──▶ (1) PREP ──▶ (2) REVIEW ──▶ (3) SIGN-OFF ──▶ (4) ACTIVATE ──▶ (5) RECORD
   coordinator   coordinator   reviewer       reviewer        coordinator      coordinator
```

### 0 — Reset to a gated state (before a real pilot)
Take everything out of `active` so demo content can't reach a citizen:
```
POST /api/admin/chunks/activate   { "all": true, "status": "unverified" }
```
(Admin-gated by the proxy — run it from the admin dashboard's chunk controls, or
authenticated against the route.) Confirm via `GET /api/admin/chunks` that no row
is `active`.

### 1 — Prep the worksheet
The claims in [`05b-review-worksheets.md`](05b-review-worksheets.md) are
pre-filled from the current guide content. Before a review, the coordinator
**re-syncs** the worksheet against the live `guides` table if content changed, so
the reviewer checks what the app actually says — not a stale copy.

### 2 — Review
Hand `05b` to the domain reviewer. For each claim they mark a verdict
(✓ correct / ✗ wrong / ~ needs nuance), write any correction, and note the
primary source + the date they confirmed it. **Corrections are applied to the
`guides` table by the coordinator, then re-reviewed** — a guide with any open ✗
does not advance.

### 3 — Sign-off
When every claim for a guide is ✓ (or ✗ resolved), the reviewer completes that
guide's sign-off block in `05b` (name, org, date). Sign-off is **per kb_id**, not
all-or-nothing — guide 101 can launch while 103 is still in review.

### 4 — Activate (only what's signed)
For a signed kb_id, activate **only its chunks**. The activate endpoint filters by
`chunk_id` or `guide_id` (not kb_id), and a kb_id spans three language guides — so
look up that kb_id's `guide_id`s and activate each:
```
GET  /api/admin/chunks                         → find guide_ids where kb_id = 101
POST /api/admin/chunks/activate  { "guide_id": <eng>, "status": "active" }
POST /api/admin/chunks/activate  { "guide_id": <fil>, "status": "active" }
POST /api/admin/chunks/activate  { "guide_id": <vis>, "status": "active" }
```
> **Never use `{ "all": true, "status": "active" }` for a real pilot.** That is the
> exact action that produced the current unverified-but-active demo state. Activate
> per signed guide, never in bulk.

### 5 — Record
Append the sign-off (reviewer, org, date, kb_id, the guide_ids activated) to the
doc-05 sprintlog's reviewer ledger, and populate the `sources` table row(s) for
each guide (name + url + `verified_on`) so citizens and auditors can see the
provenance. The gate's definition-of-done is met **per guide** when its row is in
`sources`, its worksheet is signed, and its chunks are `active`.

---

## Done = all three true, per guide

1. Worksheet signed by a named domain reviewer (in `05b`).
2. `sources` row(s) exist with a dated primary source.
3. The guide's chunks are `active`; everything unverified is not.

Until a guide clears all three, it stays `unverified` and invisible to citizens —
the build and the demo are unaffected.

---

## Recommended hardening (not blocking — for Justin's lane)

The gate works, but two cheap changes would make it tamper-evident:
- **Add `verified_by` / `verified_on` columns to `doc_chunks`**, set by the
  activate route, so an `active` chunk carries *who* cleared it — not just a status.
- **Add a `kb_id` filter to `/api/admin/chunks/activate`** so a guide activates in
  one signed call across all three languages, instead of three guide_id calls that
  can drift (one language activated, another forgotten).
