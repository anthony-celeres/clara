# Sprintlog — Doc 05 Knowledge Base Content Gate (2026-06-23)

## Status: OPEN — requires domain reviewer sign-off before pilot

This gate blocks real-user launch. Build passes with seed content; citizens must not use the app until all five checklist items below are cleared.

---

## Guides requiring verification (9 entries: 3 guides × 3 languages)

| kb_id | Title | Primary law | Languages |
|-------|-------|-------------|-----------|
| 101 | Clerical Error Correction (RA 9048) | RA 9048 + RA 10172 | eng / fil / vis |
| 102 | Late Registration of Birth | PSA CRS Rules + Admin Order 1 s. 1993 | eng / fil / vis |
| 103 | Indigenous Peoples Registration (IPRA RA 8371) | RA 8371 + NCIP–PSA joint circular | eng / fil / vis |

---

## Primary sources to verify against (per guide)

### kb_id 101 — RA 9048 Clerical Error Correction
- Republic Act No. 9048 (2001) — authorizes LCRO/consul to correct clerical errors without court order
- Republic Act No. 10172 (2012) — extends RA 9048 to day/month of birth and sex corrections
- PSA implementing rules: OCRG Administrative Order No. 1 s. 2012
- **Verify:** ₱1,000 filing fee (this is the base; LGUs may add local fees — confirm current PSA bulletin)
- **Verify:** 1–3 month timeline (10-day posting is mandated; PSA affirmation adds time — confirm current processing)

### kb_id 102 — Late Registration of Birth
- Civil Registry Law (Act 3753, as amended)
- PSA OCRG Administrative Order on late registration procedures
- **Verify:** ₱200–₱500 fee range (highly variable by LGU — document the source LGU used for the range)
- **Verify:** Joint Affidavit of two witnesses requirement + acceptable supporting document list (School Form 137, baptismal, etc.)
- **Verify:** 10-day posting period is still required for late registrations

### kb_id 103 — IPRA RA 8371 / BRAP
- Republic Act No. 8371 (IPRA, 1997)
- NCIP–PSA Joint Circular No. 1 s. 2012 (or most recent joint circular on IP registration)
- BRAP (Birth Registration Assistance Project) — confirm it is still active and covers the stated fee waiver
- **Verify:** Tribal Chieftain Certification is accepted in lieu of standard school/baptismal records (cite specific NCIP circular)
- **Verify:** NCIP Certificate requirement status (is it mandatory or optional?)

---

## Sources table SQL (run in Supabase SQL editor)

```sql
CREATE TABLE IF NOT EXISTS sources (
  source_id   SERIAL PRIMARY KEY,
  guide_id    INT REFERENCES guides(guide_id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT,
  is_primary  BOOLEAN DEFAULT true,
  verified_on DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sources"
  ON sources FOR SELECT
  USING (true);

CREATE POLICY "Admin write sources"
  ON sources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
```

After running, populate with a row per guide per primary source before pilot.

---

## Definition-of-done checklist

- [ ] Every active guide traces to a cited primary source in the `sources` table
- [ ] Fees + timelines verified and dated (fees change — note the date verified)
- [ ] All active guides present in eng/fil/vis with matching step indexes and requirement arrays
- [ ] Domain reviewer sign-off recorded here (name + date + org)
- [ ] Seed/demo guides removed from the live `guides` table or marked `is_active = false`

**Reviewer ledger (one row per guide, filled at sign-off — workflow step 5).**
Run reviews via [`../../handoff/05a-content-review-workflow.md`](../../handoff/05a-content-review-workflow.md);
the reviewer fills [`../../handoff/05b-review-worksheets.md`](../../handoff/05b-review-worksheets.md).
A guide is pilot-cleared only when its row here is complete **and** its chunks are `active` **and** it has a `sources` row.

| kb_id | Guide | Reviewer | Org | Date | guide_ids activated | Status |
|-------|-------|----------|-----|------|---------------------|--------|
| 101 | Clerical Error Correction (RA 9048) | | | | | ☐ pending |
| 102 | Late Registration of Birth | | | | | ☐ pending |
| 103 | Indigenous Peoples Registration (IPRA RA 8371) | | | | | ☐ pending |

---

## What does NOT need to change before pilot

- The app's system prompt (grounding + LCRO-defer instruction) — keep as-is
- The disclaimer on every CLARA surface (guidance, not legal representation) — keep as-is
- The `[CHECKLIST: Guide Title]` contract between chat route and frontend — keep as-is
- Mock/seed personas (Sharmaine, Vanessa, Melanie) — fine for internal demos, not for citizens
