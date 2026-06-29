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

## Change history

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

- Optional: limited **parallel** photo uploads for speed (current default is
  sequential for reliability).
- Optional: client-side downscaling as a toggle for users on slow connections
  (declined for now — quality preferred).
