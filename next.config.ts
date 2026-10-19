import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Serwist PWA: compiles src/app/sw.ts → public/sw.js with a full precache
// manifest (incl. _next/static) so CLARA actually works offline. Auto-registers
// the SW (register defaults to true). See src/app/sw.ts + docs/architecture.
// @serwist/next is a webpack plugin; production builds must use the webpack
// builder (`next build --webpack`). Disabled in dev so `next dev` keeps using
// Turbopack with no conflict (offline is a production concern anyway).
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(nextConfig);
