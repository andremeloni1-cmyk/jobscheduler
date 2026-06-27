# Job Scheduler

A self-hosted job scheduling dashboard for Andre Meloni's kitchen/joinery install
business. Replaces the Base44 "Install Dashboard". Runs on Hostinger shared
hosting (PHP 8 + MySQL) with Google Calendar, Drive, and Gmail wired in.

## Features
1. **Confirm & book jobs** → creates a Google Calendar event
2. **Cancel & remove jobs** → deletes the Calendar event
3. **Organise job PDFs in Google Drive** → one folder per job, upload from the app
4. **Maintenance reports** → custom, job-by-job line-item builder; print or email
5. **View all calendar events** → the Calendar tab
6. **Auto-email clients you're available** → one-click availability email

All client emails (confirm / cancel / available / reports) send from your real
`andre@andremeloniphotography.co` via the Gmail API.

## Stack
- PHP 8, MySQL (PDO)
- Google REST APIs over cURL — **no Composer dependencies**
- Vanilla server-rendered PHP + one CSS file — no build step

## Project layout
```
config/   config.sample.php → copy to config.php (your secrets; not web-served)
lib/      db.php, app.php (session/auth/layout), google.php (OAuth + APIs)
public/   the web app — index, jobs, job, report, calendar, clients, login, oauth, setup
schema.sql   database tables + your 3 seeded clients
DEPLOY.md    step-by-step Hostinger deployment runbook
```

## Setup
See **DEPLOY.md**. Short version: create the DB + import `schema.sql`, create
Google OAuth credentials, upload files, fill `config.php`, run `setup.php` once,
then **Connect Google**.

## Local testing (optional)
With PHP installed locally and a local MySQL:
```
php -S localhost:8000 -t public
```
You still need a `config/config.php` pointing at a local DB, and a Google OAuth
client with `http://localhost:8000/oauth.php` as a redirect URI.
```
