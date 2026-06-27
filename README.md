# JoineryFlow

A **mobile-first dashboard to organise and schedule joinery jobs from your phone**,
with Google automations built in. The app lives in **[`app/`](app/)**.

![status](https://img.shields.io/badge/stack-Next.js%20·%20TypeScript%20·%20Prisma-ba6b2b)

## Features

1. **Auto-add to Google Calendar** when a job is accepted.
2. **Move & delete jobs** — drag on the calendar to reschedule; deleting clears the calendar event.
3. **Save job PDFs from email to Google Drive** and open them straight from the calendar event.
4. **Automated client emails** on accept / move / cancel (editable templates).
5. **Maintenance reports** per job — fill in, generate a branded PDF, save to Drive and email the client.

Runs in a safe **demo mode** before you connect Google, so you can try everything
immediately, then flip the integrations on from Settings.

## Get started

```bash
cd app
cp .env.example .env
npm install
npx prisma migrate deploy && npx prisma db seed
npm run dev          # http://localhost:3000
```

- **App docs:** [`app/README.md`](app/README.md)
- **Connect Google:** [`app/deploy/GOOGLE_SETUP.md`](app/deploy/GOOGLE_SETUP.md)
- **Deploy to Hostinger (one command):** [`app/deploy/DEPLOY.md`](app/deploy/DEPLOY.md)

```bash
# on a fresh Ubuntu Hostinger VPS:
sudo DOMAIN=jobs.yourdomain.com EMAIL=you@yourdomain.com bash app/deploy/install.sh
```

---

## Archived: JS7 JobScheduler deployment kit

This repository previously held a deployment kit for **JS7 JobScheduler** (an
unrelated server-orchestration product). That material is unrelated to the
JoineryFlow app and is kept only for reference:

- [`deploy/`](deploy/) — JS7 install scripts
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — JS7 runbook
- [`legacy/`](legacy/) — JobScheduler 1.x samples

It is **not** used by JoineryFlow and can be ignored (or removed) safely.
