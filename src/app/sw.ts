/// <reference lib="webworker" />
// CLARA service worker (Serwist). Replaces the hand-rolled public/sw.js, which
// skipped `_next/` and so never cached the app runtime — leaving the app blank
// offline. Serwist precaches the full build (incl. _next/static) and runtime-
// caches pages, with /offline as the document fallback.
//
// Built by @serwist/next from this source into public/sw.js (a build artifact,
// gitignored). Do not edit public/sw.js directly.

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next — the precache manifest of every
    // build asset (the thing the old SW was missing).
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();
