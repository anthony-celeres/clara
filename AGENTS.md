<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

Notable in this project:
- This is **Next.js 16** + **React 19** + **Tailwind CSS v4** (CSS-first `@theme` in `src/app/globals.css`, no `tailwind.config.js`).
- Middleware is the file `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`); it exports `proxy()` and a `config.matcher`.
- Fonts load via `next/font/google` (Inter) — the first build/dev run needs network to self-host the font.
