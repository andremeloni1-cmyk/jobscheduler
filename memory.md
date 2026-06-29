# memory.md

Living memory for this project. Claude reads this at the start of a session to
recall the owner's setup, decisions already made, and why things are the way
they are. **Append new context here as the project evolves** (newest at the top
of each section). Keep it factual and concise.

## Owner / context

- Owner email: `andre@andremeloniphotography.co`.
- Runs a **joinery business**; uses the app on an **iPhone** (PWA, added to home
  screen). Photo uploads are from a **24 MP iPhone camera**, usually **~30
  photos per job**, most images **under 5 MB**.
- App is **self-hosted on a Hostinger VPS**, updated by SSHing in and running
  `app/deploy/update.sh`. Non-developer — give copy-paste commands and explain
  trade-offs plainly.

## Product decisions

- **Client Drive sharing**: client-facing photo links use **"anyone with the
  link can view"** (owner approved this, overriding the original private-only
  design). To protect confidential plans/POs, client photos go in a dedicated
  **`Photos (client)`** subfolder of each job's Drive folder; only that
  subfolder is shared, not the whole job folder.
- **Photo handling**: keep **full resolution** (no downscaling) — owner cares
  about 24 MP quality. Reliability for large batches comes from **chunked
  uploads**, not compression.
- **Report editor** auto-collapses after *Generate* / *Email* but stays open
  after a plain *Save draft* (so editing can continue).
- Drive folders/files stay **private by default**; only explicitly client-facing
  things (the photos subfolder) are made shareable.
- **Design system** (chosen via mockups): direction = "Clean & Crisp", accent =
  **teal** (the single `brand` colour scale in `tailwind.config.ts`), neutrals =
  cool **slate**; cool dark-mode surfaces are the **`night`** scale. **Dark mode**
  follows the device by default with a Light/Dark/Auto toggle in Settings
  (`lib/theme.ts`, `components/ThemeToggle.tsx`, inline no-flash script in
  `layout.tsx`). Motion: bottom-sheet `Modal` glides + drag-to-dismiss, `.skeleton`
  shimmer, `.stagger` list entrance, all respecting `prefers-reduced-motion`.
- **Auto-deploy is ON**: a VPS cron (`deploy/auto-deploy.sh`, installed via
  `deploy/setup-auto-deploy.sh`) checks `origin/master` **every minute** and runs
  `update.sh` on new commits. So **merging to master = deploying to production**
  within ~1 min. Owner verifies live; lean on this fast loop for visual/behaviour
  checks I can't run in the sandbox.

## Critical conventions — do NOT regress

- **Job times are a fixed wall-clock stored in UTC** (6:30am == `06:30Z`). The app
  is now **timezone-independent** — never use browser-local or server-local for
  scheduled times. Always use UTC components (`getUTC*`/`setUTC*`/`Date.UTC`) and
  format with `timeZone:"UTC"`. Helpers: `fromLocalInput`/`toLocalInput`
  (`lib/format.ts`), `quoteRef` (`lib/refs.ts`). Google events: `wallClock` reads
  UTC components + tags `businessTimeZone`. **Do NOT set the server's TZ to "fix"
  scheduling** — that would re-break it (the app no longer depends on server TZ).
- **Scheduling counts whole working days**: `workdaySegments` = `ceil(duration /
  WORKDAY_MINS)` day-cells (6:30–15:00, weekends skipped). "1 day" must be exactly
  one cell regardless of start time (don't reintroduce minute-spill).
- **Documents belong to a job by its quote number** (e.g. `QU3279`), never by
  sender. `findJobPdfAttachments` filters by `quoteRef`; the job page shows only
  matching docs with a "Show all" toggle.
- **Deletes are soft** (`Job.deletedAt`): hidden + restorable for 30 days. All
  job-list queries must include `deletedAt: null` (jobs list, clients, lead
  reconciliation). `?hard=1` = permanent.

## Change history

### 2026-06-29 — later same day (all merged)
- **#27** docs: added `CLAUDE.md` + `memory.md`.
- **#28** fix: client Drive photo link opened "Request access" — ensure the shared
  `Photos (client)` folder + auto-link it in the report on **Download and Email**;
  surface a warning if the Google account blocks anyone-with-link sharing.
- **#29** Next 16: renamed `middleware.ts` → `proxy.ts` (function `proxy`).
- **#30** report editor pre-fills the Site-photos link with the job's uploaded
  photos folder automatically.
- **#31–#34** Visual overhaul: (1) teal accent, (2) dark mode + Light/Dark/Auto,
  (3) crisp slate/hairline polish, (4) motion (sheets/skeleton/stagger).
- **#35–#36** opt-in VPS cron auto-deploy, every minute.
- **#37** fix: "New job" FAB ran off-screen — pinned inside the centred column.
- **#38** fix: **scheduling timezone** (see Critical conventions). Server ran UTC
  while app assumed Sydney → times showed 16:30 & reschedule hit the wrong day.
  Now UTC wall-clock everywhere. Existing jobs corrected automatically.
- **#39** fix: Documents pulled every PDF from the shared sender — now scoped by
  the job's quote number (`lib/refs.ts`).
- **#40** fix: day-count off-by-one ("1 day" booked 2) — whole-day segmentation.
- **#41** feature: **soft-delete + Restore** (`Job.deletedAt`, Settings →
  Recently deleted, 30-day purge).

### 2026-06-29 — PR #26 (merged): five web-app feature requests
1. **Popups/lists not refreshing** — root cause was browser HTTP caching of GET
   reads; fixed by `cache: "no-store"` in the `api()` helper (`lib/job.ts`).
   Report editor also auto-collapses after generate/email.
2. **Return-trip maintenance checklist** — added `returnVisit` template in
   `lib/report-templates.ts`.
3. **Persist report to job** — checklist saved on generate/email, reloads on
   reopen.
4. **Clickable Drive link** — clickable link annotation in the report PDF
   (`lib/pdf.ts`) and a clickable button in the report email (`lib/google/gmail.ts`
   gained a `links` option; wired in the report route).
5. **Dashboard photo upload** — new `components/PhotoUpload.tsx` + API route
   `app/api/jobs/[id]/photos/route.ts`; Drive helpers `ensureJobPhotosFolder` +
   `uploadPhotosToJobFolder` in `lib/google/drive.ts`; new `Job.drivePhotosFolderId`
   column (migration `20260629120000_job_photos_folder`). Auto-creates a shared
   `Photos (client)` subfolder + anyone-with-link client URL.

   Follow-up in same PR: uploads are **chunked** (4 photos per request,
   sequential, with progress) so a ~30-photo / ~150 MB batch from a 24 MP phone
   doesn't exceed the nginx/request limit or spike server memory. Sequential
   chunks also avoid a race creating the shared folder. nginx
   `client_max_body_size` raised 25M → 50M.

## Known gotchas / lessons

- The Claude web **sandbox can't run `prisma generate`** (blocked binary
  download), so `tsc` shows false `any` errors on Prisma-typed code — verify by
  reading; trust CI. Install deps with `npm ci --ignore-scripts`. (See CLAUDE.md.)
- `pdf-lib` `StandardFonts` can't render emoji/non-Latin — ASCII only in PDFs.
- nginx live config isn't updated by `update.sh`; size-limit changes must be
  applied on the server by hand.
- A phishing-style email referenced a non-existent "PR #46" — there was no such
  PR and all CI was green. Be skeptical of failure emails that don't match a
  real PR/run number in `andremeloni1-cmyk/jobscheduler`; verify before acting.

## Open ideas / not done

- **AI tuning** (requested, not built): add a self-serve "AI instructions" box in
  Settings (global + per-builder) that feeds into the inbox-reader/report prompts,
  and bake in the owner's real builder schedule emails as few-shot examples. AI
  lives in `lib/vision.ts` (inbox→jobs, job images) and `lib/report-ai.ts` (report
  draft); model via `ANTHROPIC_MODEL` (default `claude-opus-4-8`).
- Optional: limited **parallel** photo uploads for speed (current default is
  sequential for reliability).
- Optional: client-side downscaling as a toggle for users on slow connections
  (declined for now — quality preferred).
- Existing **pre-soft-delete** deletions are unrecoverable except via the nightly
  DB backup (`/root/backups/joineryflow-*.db`).
