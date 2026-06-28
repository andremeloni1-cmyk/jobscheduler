# JoineryFlow

A mobile-first dashboard to **organise and schedule joinery jobs from your phone**,
with Google automations built in.

Built with Next.js 14, TypeScript, Tailwind CSS, Prisma + SQLite, and the Google
APIs (Calendar, Drive, Gmail).

## What it does

| # | Feature | How |
|---|---------|-----|
| 1 | **Auto-add to Google Calendar when a job is accepted** | Moving a job to *Accepted/Scheduled* creates (or updates) a calendar event with the client, address and document links. |
| 2 | **Move & delete jobs** | Drag a job to another day on the calendar, or use *Reschedule*. Deleting a job also removes its calendar event. The client can be auto-notified of moves. |
| 3 | **Save job PDFs from email → Google Drive, openable from the event** | *Find in email* searches Gmail for the job's PDFs, files them in a per-job Drive folder, and embeds the links in the calendar event description so they open straight from the event. |
| 4 | **Automated client emails** | Accept / move / cancel each send a templated email from your Gmail. Templates are fully editable in Settings. |
| 5 | **Maintenance reports per job** | Fill out a report, generate a branded PDF, save it to Drive and email it to the client in one tap. |
| 6 | **Incoming jobs to approve** | Watches your inbox for emails from trusted senders (managed in Settings), turns each into a lead with PDFs filed to Drive, and lists them to Approve (accept + auto-confirm) or Dismiss. Auto-checks every 15 min (cron) plus a manual button. |

### Demo mode

The app is fully usable **before** you connect Google. Until then it runs in
*demo mode*: jobs, scheduling, drag-to-move, reports and PDF generation all work
locally; the calendar/Drive/email steps are logged to each job's activity feed
instead of being pushed to Google. Connect Google in **Settings** to turn them on
for real — no code changes needed.

## Quick start (local)

```bash
cd app
cp .env.example .env          # edit values (see below)
npm install
npx prisma migrate deploy     # create the SQLite DB
npx prisma db seed            # email templates + demo jobs
npm run dev                   # http://localhost:3000
```

### Environment variables (`.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | yes | `file:./joineryflow.db` for SQLite |
| `APP_URL` | yes | Public base URL; used to build the OAuth redirect |
| `OWNER_EMAIL` | yes | The single owner account |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google | From Google Cloud Console — see [deploy/GOOGLE_SETUP.md](deploy/GOOGLE_SETUP.md) |
| `APP_PASSWORD` | optional | Enables a password gate on the whole app |
| `SESSION_SECRET` | yes | Long random string (`openssl rand -hex 32`) |

## Connecting Google

1. Follow **[deploy/GOOGLE_SETUP.md](deploy/GOOGLE_SETUP.md)** to create OAuth
   credentials and enable the Calendar, Drive and Gmail APIs.
2. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and restart.
3. Open **Settings → Connect Google account**.

## Deploying to Hostinger

See **[deploy/DEPLOY.md](deploy/DEPLOY.md)**. On a fresh Ubuntu VPS it's one command:

```bash
sudo DOMAIN=jobs.yourdomain.com EMAIL=you@yourdomain.com bash deploy/install.sh
```

This installs Node, builds the app, runs it under pm2, and sets up nginx + free
HTTPS via Let's Encrypt.

## Project layout

```
app/
  prisma/schema.prisma     data model (jobs, clients, documents, reports, templates)
  src/app/                 pages (dashboard, calendar, job detail, settings, login)
  src/app/api/             REST API + automations + Google OAuth
  src/lib/google/          Calendar / Drive / Gmail / OAuth wrappers (demo-safe)
  src/lib/automations.ts   the status-change & reschedule orchestration
  src/lib/pdf.ts           maintenance-report PDF generation (pdf-lib)
  src/components/          UI components
  deploy/                  Hostinger install + nginx + pm2 + docs
```

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Dev server |
| `npm run build` | Migrate + production build |
| `npm start` | Run the production build |
| `npm run typecheck` | TypeScript check |
| `npm run db:seed` | Seed templates + demo data |
