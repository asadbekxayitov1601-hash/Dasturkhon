# Dasturkhon — Agent Guide

Recipe app for Uzbek cuisine. Frontend: React + Vite + Tailwind (Vercel).
Backend: Express + Prisma (Railway). DB: Neon Postgres. Email/SMS: Brevo.
Live: dasturkhonhub.com (served on www.dasturkhonhub.com).

## ⛔ NON-NEGOTIABLE: translate everything
**Every string a user can see MUST be translated into all three languages**
(`src/i18n/locales/en.json`, `uz.json`, `ru.json`) and rendered via `t()`.
This includes labels, placeholders, buttons, headings, toasts, empty states,
and error messages. NEVER ship hardcoded English or a bare `t()` key.
- When adding/editing any UI, add the keys to all 3 locales in the same change.
- Verify a key exists in all 3 files before using it (a missing key renders raw).
- Backend user-facing errors return a stable `code`; the frontend maps it to
  `auth.err.*` (see src/app/lib/authError.ts). Add new codes to all 3 locales.
Languages: Uzbek (Latin) + Russian are first-class; English third.

## Branding
- Use the owner's own logo/assets (src/app/assets/logo.png, favicon.png).
  Never substitute generated art. Palette: teal / gold / terracotta.

## Git workflow (every change)
- branch → `NODE_ENV=production npx vite build` → commit → push → open PR via the
  GitHub API → squash-merge → `git checkout main && git pull --ff-only` → delete branch.
- NEVER commit `server/prisma/dev.db`. Keep PR titles/bodies ASCII (Cyrillic
  breaks the GitHub API JSON). Don't put non-ASCII in code identifiers.
- Trailers: `Co-Authored-By: Claude ...` on commits; 🤖 line on PR bodies.

## Backend gotchas
- Email + SMS go through **Brevo HTTP APIs**, NOT SMTP (Railway blocks SMTP ports).
- Anything that must survive restarts (verification codes) lives in the **DB**
  (VerificationCode table), never in-memory Maps — Railway is ephemeral.
- TWO schemas: `schema.prisma` (sqlite, dev) + `schema.prod.prisma` (postgres).
  Update BOTH. After schema edits: `cd server && npx prisma db push` (dev).
  Prod (Railway) auto-applies the schema on boot: `startCommand` runs
  `prisma db push --skip-generate && node index.js` (non-destructive — additive
  changes apply automatically on deploy; a change needing data loss fails the
  boot instead of silently dropping data, so handle those deliberately).
- Be careful adding `@unique` to existing columns — it can break prod `db push`.
  Enforce uniqueness in app logic for new optional columns (googleId, phone, telegramId).
- Frontend talks to the API same-origin in prod (config.ts); Vercel rewrites
  `/api/*` to Railway. CORS allowlist = FRONTEND_URL env + *.vercel.app.

## Auth (three options)
1. Email + password with an emailed verification code (signup + login 2FA).
2. "Continue with Google" (gated on VITE_GOOGLE_CLIENT_ID).
3. "Log in with Telegram" widget (gated on VITE_TELEGRAM_BOT; backend verifies
   the hash with TELEGRAM_BOT_TOKEN). Bot domain must match the live host.

## UI conventions
- Confirm dialogs: centered, two buttons (Cancel + confirm). Toasts ~3s.
- Dark + light mode via CSS vars in src/styles/theme.css. Prefer var(--...) and
  utility classes that the dark overrides cover; avoid raw inline hex.

## Deliverables
- Send plans, forecasts, and long-form/multi-part content as a **.docx**
  (saved to the user's Documents), not just inline chat.
