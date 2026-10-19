# 05 — Knowledge-base content (the hard gate)

This is the most important doc, and the one that is **not** a keys-and-wiring task. CLARA gives citizens guidance they act on — they travel to an LCRO, pay fees, file petitions based on what it says. If the content is wrong, CLARA causes exactly the wasted trips it exists to prevent.

## The rule (project decision)

**Source real, verified legal content before any real-user pilot.** The guides currently in `src/lib/seed-data.ts` (`GUIDES_SEED`) and the SQL examples are **prototype/demo placeholders** — useful for building and demoing the UI, not safe to put in front of citizens.

This gate blocks the live launch, not the build. Mock/seed content is fine for development and internal demos; it must be replaced before a public or partner pilot.

> **The process for clearing this gate is operationalized in
> [`05a-content-review-workflow.md`](05a-content-review-workflow.md)** (the
> reset → prep → review → sign-off → activate → record flow and the
> `effective_status` enforcement point) and
> [`05b-review-worksheets.md`](05b-review-worksheets.md) (the pre-filled,
> no-SQL claim sheets a domain reviewer fills in). Use those to run an actual
> review; this doc is the policy behind them.

## What "verified content" means

For each guide (Birth, Marriage, Death; late registration; RA 9048 correction; IPRA RA 8371 registration):

1. **Trace every fact to a primary source** — the actual law / issuance / agency bulletin:
   - RA 9048 and RA 10172 (clerical error / day-month / sex corrections)
   - RA 8371 (IPRA) + the relevant NCIP–PSA joint guidance and BRAP details
   - PSA late-registration procedures; LCRO-specific steps where they vary
2. **Record the source** in the `sources` table (name + URL + `is_primary`) for each guide. Citizens and auditors must be able to see where a requirement comes from.
3. **Confirm fees and timelines** against current agency figures (these change — date them).
4. **Translation parity** — every guide must exist in `eng`, `fil`, and `vis` with matching step indexes and requirement arrays (the chat falls back to `fil`; the offline cache and checklists assume parity).
5. **Have it reviewed** by someone with civil-registry domain knowledge (an LCRO contact or the project's domain advisor) before activation.

## How content reaches the app

- Admins enter/edit guides via the admin **KB manager** (`/admin/guides` → `/api/guides`), which writes to the `guides` table.
- The chat RAG must read from that table (see doc 03), so verified edits take effect immediately.
- The offline cache is compiled from active guides (`is_active = true`) into `clara-guide-cache.json` (< 5 MB) — only verified guides should be active.

## Guardrails already in the system (keep them)

- The assistant answers ONLY from the supplied guide and defers to the LCRO when unsure (deterministic grounding).
- Every CLARA surface carries the disclaimer that it provides guidance, not legal representation, and is not a government agency. Keep it.

## Definition of done for this gate

- [ ] Every active guide traces to a cited primary source in the `sources` table.
- [ ] Fees + timelines verified and dated.
- [ ] All active guides present in eng/fil/vis with matching indexes.
- [ ] Domain reviewer sign-off recorded (a sprintlog entry naming the reviewer and date).
- [ ] Seed/demo guides removed or clearly marked inactive.

Until all five are checked, CLARA stays in development/demo — not in front of citizens.
