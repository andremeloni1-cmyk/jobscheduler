import { prisma } from "@/lib/db";
import { findLeadMessages } from "@/lib/google/gmail";
import { uploadToJobFolder } from "@/lib/google/drive";
import { isGoogleConnected } from "@/lib/google/oauth";
import { logActivity } from "@/lib/automations";
import { nextReference } from "@/lib/utils";
import { extractJobsFromEmail, visionConfigured } from "@/lib/vision";
import { WORKDAY_MINS, jobEnd } from "@/lib/schedule";

const IMAGE_RE = /^image\//i;
// Subjects that are clearly NOT new jobs to book (common misspellings included).
const NON_JOB_RE = /\b(maintenance|maintanance|maintenence|mantenance|mantanace|matanance|mantanance)\b/i;

/**
 * Scans the mailbox for new emails from the configured trusted senders and
 * turns each new one into a job lead (status "lead") for the owner to approve.
 * Idempotent: messages already imported (by Gmail message id) are skipped.
 */
export async function scanForLeads(
  opts: { force?: boolean } = {}
): Promise<{ created: number; connected: boolean }> {
  if (!(await isGoogleConnected())) return { created: 0, connected: false };

  const sources = await prisma.leadSource.findMany({ where: { enabled: true } });
  const emails = sources.map((s) => s.email.toLowerCase());
  if (emails.length === 0) return { created: 0, connected: true };

  const messages = await findLeadMessages(emails, { sinceDays: 30, maxMessages: 25 });

  let created = 0;
  for (const m of messages) {
    // Always skip emails that still have job(s) in the app (avoid duplicates).
    const exists = await prisma.job.findFirst({ where: { gmailMessageId: m.messageId } });
    if (exists) continue;
    // The automatic scan also skips anything already scanned (even if it made no
    // jobs) so non-job emails aren't re-run through AI every 15 min. A manual
    // "Check inbox" (force) re-evaluates them — e.g. after dismissing a lead.
    if (!opts.force) {
      const seen = await prisma.processedEmail.findUnique({ where: { messageId: m.messageId } });
      if (seen) continue;
    }

    const markProcessed = (jobsCreated: number, reason?: string) =>
      prisma.processedEmail
        .upsert({
          where: { messageId: m.messageId },
          create: { messageId: m.messageId, jobsCreated, reason },
          update: { jobsCreated, reason },
        })
        .catch(() => {});

    // Maintenance / non-job emails are never bookable jobs — skip without AI.
    if (NON_JOB_RE.test(m.subject || "")) {
      await markProcessed(0, "maintenance");
      continue;
    }

    const imageAttachments = m.attachments.filter((a) => IMAGE_RE.test(a.mimeType));
    const pdfAttachments = m.attachments.filter(
      (a) => a.mimeType === "application/pdf" || /\.pdf$/i.test(a.filename)
    );

    // Ask AI to split the email (text + images) into its distinct jobs. PDFs are
    // not read (cost) — only their filenames are sent so the AI can match each
    // attachment to the right job.
    let extracted: Awaited<ReturnType<typeof extractJobsFromEmail>> = null;
    if (visionConfigured()) {
      extracted = await extractJobsFromEmail({
        subject: m.subject,
        body: m.body || m.snippet || "",
        images: imageAttachments.map((a) => ({ filename: a.filename, data: a.data, mimeType: a.mimeType })),
        pdfNames: pdfAttachments.map((a) => a.filename),
      });
    }

    // AI ran and judged there are no new bookable jobs (report request, etc.).
    if (extracted !== null && extracted.length === 0) {
      await markProcessed(0, "no_new_jobs");
      continue;
    }

    // Duration: prefer an explicit multi-day count, else AI minutes, else one work day.
    const durationFor = (j: { durationMins?: number; days?: number }): number => {
      if (j.days && j.days > 0) return Math.round(j.days) * WORKDAY_MINS;
      if (j.durationMins && j.durationMins > 0) return Math.round(j.durationMins);
      return WORKDAY_MINS;
    };

    // Build the list of jobs to create — AI-split, or a single fallback lead.
    type NewJob = {
      title: string;
      description: string;
      address?: string | null;
      start?: Date | null;
      durationMins: number;
      attachments: string[];
    };
    let toCreate: NewJob[];
    if (extracted && extracted.length > 0) {
      toCreate = extracted.map((j) => ({
        title: j.title?.trim() || "New job",
        description: j.description?.trim() || "",
        address: j.address?.trim() || null,
        start: combineDateTime(j.date, j.time),
        durationMins: durationFor(j),
        attachments: Array.isArray(j.attachments) ? j.attachments : [],
      }));
    } else {
      toCreate = [
        {
          title: m.subject.replace(/^(re:|fwd:)\s*/i, "").trim() || "New enquiry",
          description: (m.body || m.snippet || "").slice(0, 1500),
          address: null,
          start: null,
          durationMins: WORKDAY_MINS,
          attachments: [],
        },
      ];
    }

    const createdJobs = [];
    const jobByFilename = new Map<string, string>(); // attachment filename -> jobId
    for (let i = 0; i < toCreate.length; i++) {
      const nj = toCreate[i];
      const job = await prisma.job.create({
        data: {
          reference: await nextReference(),
          title: nj.title,
          description: nj.description,
          status: "lead",
          address: nj.address,
          clientName: m.fromName,
          clientEmail: m.fromEmail,
          leadSource: m.fromEmail,
          gmailMessageId: m.messageId,
          gmailThreadId: m.threadId,
          scheduledStart: nj.start,
          scheduledEnd: nj.start ? jobEnd(nj.start, nj.durationMins) : null,
          durationMins: nj.durationMins,
        },
      });
      createdJobs.push(job);
      created++;
      for (const fn of nj.attachments) jobByFilename.set(fn, job.id);
    }

    // File each attachment into its matching job's Drive folder (AI-matched by
    // filename), falling back to the first job.
    const primary = createdJobs[0];
    if (primary) {
      for (const att of m.attachments) {
        const targetId = jobByFilename.get(att.filename) || primary.id;
        const target = createdJobs.find((j) => j.id === targetId) || primary;
        const uploaded = await uploadToJobFolder(
          { id: target.id, reference: target.reference, title: target.title },
          att.filename,
          att.data,
          att.mimeType
        );
        if (uploaded) {
          await prisma.document.create({
            data: {
              jobId: target.id,
              name: uploaded.name,
              driveFileId: uploaded.fileId,
              webViewLink: uploaded.webViewLink,
              source: "gmail",
              mimeType: uploaded.mimeType,
            },
          });
        }
      }
      const note =
        createdJobs.length > 1
          ? `AI split this email into ${createdJobs.length} jobs`
          : `Imported from email — ${m.fromName} <${m.fromEmail}>`;
      await logActivity(primary.id, "lead", note, { messageId: m.messageId, jobs: createdJobs.length });
    }

    await markProcessed(createdJobs.length);
  }

  return { created, connected: true };
}

/** Combines a YYYY-MM-DD date and optional HH:mm time into a Date, or null.
 * Defaults to the standard work-day start (06:30) when no time is given.
 * Safety net: if the AI returned a clearly past date (usually a wrong year),
 * roll the year forward so new jobs are never booked in the past.
 *
 * NOTE: the time is parsed in the SERVER's local timezone and stored as a
 * "floating" wall-clock instant. The calendar sync reads it back the same way
 * (see wallClock() in google/calendar.ts) and tags the event with BUSINESS_TZ,
 * so 06:30 stays 06:30 for the business. This only holds while the server's
 * timezone is stable — keep both halves in sync if that ever changes. */
function combineDateTime(date?: string, time?: string): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "06:30";
  let d = new Date(`${date}T${t}:00`);
  if (isNaN(d.getTime())) return null;

  // More than a week in the past → almost certainly a wrong year. Bump it.
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  for (let guard = 0; d < weekAgo && guard < 5; guard++) {
    d = new Date(d.getFullYear() + 1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0);
  }
  return d;
}

// Domains catch every staff member at a company (emily@, steve@, service@, …).
const DEFAULT_SOURCES = [
  { name: "mii Kitchens", email: "miikitchen.com.au" },
  { name: "Harrington Kitchens", email: "harringtonkitchens.com.au" },
  { name: "Peter Baldwin (Ingenuity Joinery)", email: "ingenuityjoinery.com" },
];

/** Seeds the default trusted senders, but ONLY on first run (empty table).
 * Re-seeding on every load would make deleted senders reappear. */
export async function ensureDefaultLeadSources(): Promise<void> {
  const count = await prisma.leadSource.count();
  if (count > 0) return;
  for (const s of DEFAULT_SOURCES) {
    await prisma.leadSource.create({ data: s }).catch(() => {});
  }
}
