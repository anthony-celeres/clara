// src/lib/crawl-sources.ts
// The curated, VERIFIED authoritative-source allow-list for KB ingestion
// (ADR-002 §3.2, §12). This is the single source of truth for both the admin
// UI (which sources to offer) and the server route (which hosts it may fetch).
//
// Discovery is curation, not crawling: every entry was fetched and confirmed
// authoritative + reachable on 2026-06-24. Government agency portals
// (psa.gov.ph, ncip.gov.ph, officialgazette.gov.ph) 403-block automated fetches
// and are deliberately ABSENT — their content is human-curated via doc-05.
//
// Safe to import client-side: this is metadata only. The server route re-checks
// every fetched host against CRAWL_ALLOW_HOSTS (defense against SSRF), so the
// client can never induce a fetch of an off-list URL.

export type CrawlSourceKind = 'statute' | 'agency';

export interface CrawlSource {
  id: string;
  label: string;
  url: string;
  kb_id: number | null;            // CLARA topic this grounds, if any
  language: 'eng' | 'fil' | 'vis';
  kind: CrawlSourceKind;
  note: string;
}

/** Hosts the crawl route is permitted to fetch. Anything else is refused. */
export const CRAWL_ALLOW_HOSTS = ['lawphil.net', 'psahelpline.ph'] as const;

export const CRAWL_SOURCES: CrawlSource[] = [
  {
    id: 'ra9048',
    label: 'RA 9048 — Clerical Error / First-Name Correction',
    url: 'https://lawphil.net/statutes/repacts/ra2001/ra_9048_2001.html',
    kb_id: 101,
    language: 'eng',
    kind: 'statute',
    note: 'Primary law: correct clerical/typographical errors + first name without a court order.',
  },
  {
    id: 'ra10172',
    label: 'RA 10172 — Day/Month-of-Birth & Sex Correction',
    url: 'https://lawphil.net/statutes/repacts/ra2012/ra_10172_2012.html',
    kb_id: 101,
    language: 'eng',
    kind: 'statute',
    note: 'Amends RA 9048 to cover day/month of birth and sex.',
  },
  {
    id: 'act3753',
    label: 'Act 3753 — Civil Register Law',
    url: 'https://lawphil.net/statutes/acts/act1930/act_3753_1930.html',
    kb_id: 102,
    language: 'eng',
    kind: 'statute',
    note: 'Legal basis for civil registration, incl. late/delayed registration.',
  },
  {
    id: 'ra8371',
    label: 'RA 8371 — IPRA (Indigenous Peoples Rights Act)',
    url: 'https://lawphil.net/statutes/repacts/ra1997/ra_8371_1997.html',
    kb_id: 103,
    language: 'eng',
    kind: 'statute',
    note: 'Legal basis for indigenous peoples registration.',
  },
  {
    id: 'psahelpline',
    label: 'PSA Helpline — Online Request FAQ',
    url: 'https://psahelpline.ph/faq',
    kb_id: null,
    language: 'eng',
    kind: 'agency',
    note: 'PSA-authorized online channel: certificate request procedure + posting periods.',
  },
];

export function getCrawlSource(id: string): CrawlSource | undefined {
  return CRAWL_SOURCES.find((s) => s.id === id);
}
