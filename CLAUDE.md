# CLAUDE.md

Guide for Claude Code working in this repository. Read this first, then read
[`memory.md`](memory.md) for project history, decisions, and the owner's setup.

## What this repo actually is

Despite the repo name (`jobscheduler`) and the legacy JS7 scripts, **the live
product is a Next.js app under [`app/`](app/) called "JoineryFlow"** — a
mobile-first PWA that helps a joinery business organise, schedule, and report on
jobs, with Google Calendar / Drive / Gmail automations.

- **`app/`** — the real application. **Almost all work happens here.**
- `deploy/`, `legacy/`, `apacheconf/` (now under `legacy/`) — unrelated JS7
  JobScheduler install scripts. Ignore unless explicitly asked.
- `app/deploy/` — the JoineryFlow VPS deployment kit (Hostinger). See below.

## Tech stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Prisma 5** ORM over **SQLite** (single file — simple VPS hosting)
- **Tailwind** for styling
- `googleapis` (Calendar/Drive/Gmail), `pdf-lib` (report PDFs),
  `@anthropic-ai/sdk` (AI autofill + vision), `web-push` (notifications)
- Node 20 (CI), deployed under pm2 behind nginx + Let's Encrypt

## Commands (run inside `app/`)

```bash
npm run dev         # local dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run build       # prisma generate && prisma migrate deploy && next build
npm run db:migrate  # create a dev migration after editing schema.prisma
npm run db:seed     # seed default email templates / account
```

There is **no test runner**. CI (`.github/workflows/ci.yml`) runs exactly:
**typecheck → lint → build**. Make those three pass before pushing.

## Project layout (`app/src/`)

- `app/` — App Router pages + API routes (`app/api/.../route.ts`)
- `components/` — React UI (client components, `"use client"`)
- `lib/` — server + shared logic:
  - `db.ts` (Prisma client), `session.ts` (password gate + cookie auth)
  - `google/` — `oauth.ts`, `calendar.ts`, `drive.ts`, `gmail.ts`
  - `automations.ts` — status-change side effects (calendar, emails, Drive)
  - `pdf.ts` — report PDF generation; `report-templates.ts` — checklists
  - `report-ai.ts`, `vision.ts` — Anthropic calls
  - `job.ts` — client-side `JobDTO` types + the `api()` fetch helper
- `prisma/` — `schema.prisma` + hand-written SQL migrations

## Conventions (match these)

- **API routes**: start with `if (!(await isAuthenticated())) return json({error:"unauthorized"},401)`,
  set `export const dynamic = "force-dynamic"`, return via the `json()` helper.
- **Client data fetching**: use the `api()` helper in `lib/job.ts` (it sets
  `cache: "no-store"` — keep it that way; browser caching of GET was a real bug
  that made lists look stale after mutations).
- **Comments** explain *why*, briefly. Match the surrounding terse style.
- **"Demo mode"**: every Google integration must no-op gracefully when Google
  isn't connected (`getAuthorizedClient()` returns `null`). Never hard-fail the
  request just because Google isn't set up.
- **PDF text** (`pdf.ts`): uses `StandardFonts.Helvetica`, which **cannot encode
  emoji or non-Latin glyphs** — use ASCII only (e.g. `[x]`, not ✓/📷) or the
  build/runtime will throw.
- **Prisma schema changes**: edit `schema.prisma` **and** add a timestamped
  migration dir under `prisma/migrations/<YYYYMMDDHHMMSS>_name/migration.sql`
  (plain `ALTER TABLE` SQL — copy the style of existing ones). `update.sh` runs
  `prisma migrate deploy` on the server.
- **Google Drive**: scope is `drive.file` (only files the app creates). Client-
  facing links use "anyone with the link can view"; keep private docs (plans/POs)
  out of shared folders — share only the dedicated `Photos (client)` subfolder.

## Environment quirks in the Claude web sandbox

These bite every session — read before assuming your code is broken:

- `npm ci` fails on the Prisma engine postinstall (egress blocks the binary
  download). **Install with `npm ci --ignore-scripts`** to populate
  `node_modules` for typechecking.
- `prisma generate` **cannot run** here (same blocked download). Without it,
  `tsc` reports spurious `implicitly has an 'any' type` errors on Prisma-typed
  values (e.g. `.map((d) => ...)`). These are **not real** — they disappear in
  CI where `prisma generate` runs. Verify Prisma-touching code by reading, and
  only trust tsc errors in files that don't depend on generated types.
- `npm`/`prisma` network: registry is direct; if a download resets, retrying or
  `--ignore-scripts` is the workaround. Don't disable TLS or unset the proxy.
- You can still validate pure logic with `npx tsx` (e.g. `pdf.ts` has no Prisma
  dependency and can be run directly).

## Git / workflow

- Develop on a `claude/...` feature branch; **never push to `master`**.
- Open a **draft PR**, let CI go green, then (if asked) mark ready + **squash
  merge** — the repo's history is one squashed commit per PR titled `… (#NN)`.
- After merge, the owner ships to the VPS with `cd app && sudo bash deploy/update.sh`.

## Deployment (Hostinger VPS)

Full docs in [`app/deploy/DEPLOY.md`](app/deploy/DEPLOY.md). Summary:
- First install: `sudo DOMAIN=... EMAIL=... bash deploy/install.sh`
- Update: `sudo bash deploy/update.sh` (pull → migrate → build → pm2 reload)
- nginx config (`deploy/nginx-joineryflow.conf`) sets `client_max_body_size`
  for uploads. The **live** file at `/etc/nginx/sites-available/joineryflow` is
  not touched by `update.sh` — change it manually + `systemctl reload nginx`.

## Key env vars (`app/.env`, see `app/.env.example`)

`DATABASE_URL`, `APP_URL`, `SESSION_SECRET`, `APP_PASSWORD` (optional gate),
`OWNER_EMAIL`, `GOOGLE_CLIENT_ID/SECRET`, `ANTHROPIC_API_KEY`,
`VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`, `CRON_SECRET`, `BUSINESS_TZ`.
