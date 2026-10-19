# CLARA — DESIGN.md (brand profile / house-style reference)

> Agent-readable design reference for CLARA, consumed by the `our-frontend-design`
> authority. **Register: product** (citizen-facing field-app UI). Extracted from
> the shipped `src/app/globals.css` on 2026-06-24 — descriptive of what exists,
> not aspirational. If this file and `globals.css` disagree, `globals.css` is the
> source of truth and this file is stale — update it.

## Design language

**Calm civic-trust soft-flat** — accessible humanist flat design with *light, real*
elevation. Deliberately **neither skeuomorphism** (no textures/material skins —
they blow the <5 MB offline budget) **nor neumorphism** (no low-contrast same-color
embossing — it fails accessibility for low-vision / low-literacy / bright-sunlight
field users). Depth comes from **real cast shadows on white + visible borders**;
clarity comes from **solid, obviously-tappable controls + familiar metaphors used
lightly** (a checklist/certificate *card*, never faux-paper).

Audience: "first-time filers with low civic literacy," mobile, offline-first for
GIDA / low-connectivity. The aesthetic must read **calm, trustworthy, and
unmistakably actionable**.

## Brand relationship

CLARA carries **its own product identity** (muted sage green) and intentionally does
**not** inherit the AI4GOV institutional palette (cyan/purple/peach) from
`standards/branding.md` — that standard governs AI4GOV-attributed *HTML
deliverables* (playbooks, decks, portals; reference/pitch registers). CLARA is a
product. Keep them separate; do not pull AI4GOV cyan into the citizen app.

## Palette (tokens — `globals.css`)

**Brand (sage = care / calm / civic trust):**
- `--primary-green #4E9C81` (Muted Sage) · `--primary-light #6AB89E` · `--primary-dark #37705C`

**Surfaces / neutrals (light):** `--background #FFFFFF` · `--surface #FFFFFF` · `--surface-highlight #EFF2F0`
**Text (light):** `--text-primary #1A1D1C` (~14:1 on white ✅) · `--text-secondary #707773` · `--text-disabled #A2AAA6`
**Lines / focus / status:** `--accent-border #E0E4E1` · `--focus-ring #6AB89E` · `--error-color #D32F2F`
**Chat:** user bubble = `--primary-green` on white; bot bubble = `--surface-highlight` on `--text-primary`.
**Dark mode** is first-class (`[data-theme="dark"]`): bg `#151716`, surface `#1E2120`, text `#EFF2F0`. Maintain parity for every new token.

Rule: **no new accent color** outside sage + the neutrals + `--error-color`. Need one? Add it as a token in `globals.css` first, then document here.

## Typography

- **Inter** (`--font` system fallback: -apple-system, Segoe UI, Roboto…).
- **Fluid scale** (mobile → ≥600px): `--fs-h1` 1.25→1.5rem · `--fs-h2` · `--fs-body-large` · `--fs-body-small` · `--fs-button` · `--fs-caption`. Use the `.text-*` utility classes, never hard-coded px.
- Weights: 400 body · 500 buttons/labels · 600 h2 · 700 h1/titles.
- ⚠️ Inter is a web font — it **must be self-hosted** (via `next/font`), never a CDN, or offline/field rendering breaks (see Gaps).

## Elevation / depth model (the differentiator)

Two-step real-shadow scale + borders. This is what makes CLARA *not* neumorphic.
- `--shadow-soft 0 4px 12px rgba(0,0,0,.05)` — resting cards, chips, header.
- `--shadow-card 0 8px 24px rgba(0,0,0,.08)` — raised/floating (drawers, dialogs, skip-link).
- Every elevated surface also carries a `1px var(--accent-border)` edge. **Border + light shadow, not embossing.**

## Affordances & components

- **Buttons:** solid `--primary-green` fill for primary; clear hover (`--primary-dark`) and pressed (`scale(.98)`) states. Affordance must be unambiguous.
- **Focus:** `:focus-visible` → `3px solid var(--focus-ring)`, offset 2px. **Never remove it.** Keyboard skip-link present.
- **Inputs:** `.input-field` — `--surface-highlight` fill, border → `--primary-green` on focus + `0 0 0 3px rgba(78,156,129,.15)` ring; `.error` → `--error-color`.
- **Chips:** `.chip` — soft sage tint, `14px` radius, `:active scale(.98)`, wraps (no truncation of suggestions).
- **Checklist:** custom checkbox with spring check (`checkmark-spring`), checked state fills sage. The light "document metaphor" lives here.
- **Mobile drawer:** bottom sheet (`.drawer-content`, `16px` top radius, slide-up).
- **Iconography:** **lucide-react** (outline, ~13–20px in-app). One icon family; don't mix sets.

## Layout signature

Mobile-first PWA. Rounded corners (8–18px), generous touch targets, calm whitespace.
`.glass-header` (sticky, `backdrop-filter: blur(12px)`, translucent). **Defer all
sizing/spacing/breakpoint values to `our-layout-anchor`** when building components —
never guess `max-w-*` / `p-*` / `gap-*`.

## Motion budget (product register)

Purposeful micro only — content entrances + state feedback, never decorative.
- `--transition-speed 250ms`, `--ease-out-expo cubic-bezier(.16,1,.3,1)`; spring `cubic-bezier(.34,1.56,.64,1)` for the check.
- Existing: `message-entry` (250ms), `checkmark-spring` (150ms), `typing-bounce`, chip/input transitions.
- 🔴 **Floor: every animation MUST be suppressed under `@media (prefers-reduced-motion: reduce)`.** Currently missing — see Gaps. No motion ships without this guard.

## Accessibility floor (non-negotiable)

High contrast (sage/near-black already clears WCAG AA), visible 3px focus rings,
keyboard skip-link, large touch targets, dark mode, reduced-motion (pending).
Designed for low-literacy, low-vision, older, and field users.

## Low-bandwidth / offline discipline

CSS-only depth (zero image assets for shadows), <5 MB cache budget, self-hosted
font, no CDN dependencies. `backdrop-filter` blur needs a solid-color fallback on
low-end Android.

## Do / Don't

**Do:** extend the existing `globals.css` tokens; solid sage primary buttons with
clear pressed states; real shadow + border for depth; lucide outline icons; honor
dark mode + focus rings on every new component; defer sizing to `our-layout-anchor`;
prove every UI change with the `visual-iteration-loop`.

**Don't:** introduce neumorphic same-color embossing or low-contrast surfaces; add
textures/material skins (skeuomorphism); add a CDN/Google-Fonts dependency; invent
a new accent color or a second icon set; pull AI4GOV cyan/purple into the citizen
app; ship motion without a `prefers-reduced-motion` guard.

## Known gaps (TODO — tracked from the 2026-06-24 design review)

1. ✅ **RESOLVED (2026-06-24)** — global `@media (prefers-reduced-motion: reduce)` suppression added to `globals.css` (zeroes animations/transitions, stops infinite loops, keeps typing dots visible). *Sub-follow-up:* this covers **CSS only**; Framer Motion (`framer-motion`) components are JS-driven and should additionally honor `useReducedMotion()`.
2. Confirm Inter is self-hosted via `next/font`, not a CDN (offline integrity).
3. Add a solid-color fallback for `.glass-header` `backdrop-filter` on low-end devices.
4. Promote the implicit elevation scale + button states into named tokens/components so they don't drift.
