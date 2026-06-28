import { prisma } from "@/lib/db";
import { findLeadMessages } from "@/lib/google/gmail";
import { uploadToJobFolder } from "@/lib/google/drive";
import { isGoogleConnected } from "@/lib/google/oauth";
import { logActivity } from "@/lib/automations";
import { nextReference } from "@/lib/utils";
import { extractJobsFromEmail, visionConfigured } from "@/lib/vision";

const IMAGE_RE = /^image\//i;
// Subjects that are clearly NOT new jobs to book (common misspellings included).
const NON_JOB_RE = /\b(maintenance|maintanance|maintenence|mantenance|mantanace|matanance|mantanance)\b/i;

/**
 * Scans the mailbox for new emails from the configured trusted senders and
 * turns each new one into a job lead (status "lead") for the owner to approve.
 * Idempotent: messages already imported (by Gmail message id) are skipped.
 */
export async function scanForLeads(): Promise<{ created: number; connected: boolean }> {
  if (!(await isGoogleConnected())) return { created: 0, connected: false };

  const sources = await prisma.leadSource.findMany({ where: { enabled: true } });
  const emails = sources.map((s) => s.email.toLowerCase());
  if (emails.length === 0) return { created: 0, connected: true };

  const messages = await findLeadMessages(emails, { sinceDays: 30, maxMessages: 25 });

  let created = 0;
  for (const m of messages) {
    // Dedup at the email level: skip if already scanned (even if it produced no
    // jobs) or already imported as job(s).
    const seen = await prisma.processedEmail.findUnique({ where: { messageId: m.messageId } });
    if (seen) continue;
    const exists = await prisma.job.findFirst({ where: { gmailMessageId: m.messageId } });
    if (exists) continue;

    const markProcessed = (jobsCreated: number, reason?: string) =>
      prisma.processedEmail.create({ data: { messageId: m.messageId, jobsCreated, reason } }).catch(() => {});

    // Maintenance / non-job emails are never bookable jobs — skip without AI.
    if (NON_JOB_RE.test(m.subject || "")) {
      await markProcessed(0, "maintenance");
      continue;
    }

    const imageAttachments = m.attachments.filter((a) => IMAGE_RE.test(a.mimeType));
    const pdfAttachments = m.attachments.filter(
      (a) => a.mimeType === "application/pdf" || /\.pdf$/i.test(a.filename)
    );

    // Ask AI to split the email (text + images + PDFs) into its distinct jobs.
    let extracted: Awaited<ReturnType<typeof extractJobsFromEmail>> = null;
    if (visionConfigured()) {
      extracted = await extractJobsFromEmail({
        subject: m.subject,
        body: m.body || m.snippet || "",
        images: imageAttachments.map((a) => ({ filename: a.filename, data: a.data, mimeType: a.mimeType })),
        pdfs: pdfAttachments.map((a) => ({ filename: a.filename, data: a.data, mimeType: a.mimeType })),
      });
    }

    // AI ran and judged there are no new bookable jobs (report request, etc.).
    if (extracted !== null && extracted.length === 0) {
      await markProcessed(0, "no_new_jobs");
      continue;
    }

    // Build the list of jobs to create — AI-split, or a single fallback lead.
    type NewJob = { title: string; description: string; address?: string | null; start?: Date | null; durationMins: number };
    let toCreate: NewJob[];
    if (extracted && extracted.length > 0) {
      toCreate = extracted.map((j) => {
        const start = combineDateTime(j.date, j.time);
        return {
          title: j.title?.trim() || "New job",
          description: j.description?.trim() || "",
          address: j.address?.trim() || null,
          start,
          durationMins: j.durationMins && j.durationMins > 0 ? Math.round(j.durationMins) : 120,
        };
      });
    } else {
      toCreate = [
        {
          title: m.subject.replace(/^(re:|fwd:)\s*/i, "").trim() || "New enquiry",
          description: (m.body || m.snippet || "").slice(0, 1500),
          address: null,
          start: null,
          durationMins: 120,
        },
      ];
    }

    const createdJobs = [];
    for (const nj of toCreate) {
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
          scheduledEnd: nj.start ? new Date(nj.start.getTime() + nj.durationMins * 60_000) : null,
          durationMins: nj.durationMins,
        },
      });
      createdJobs.push(job);
      created++;
    }

    // File the email's attachments into the first job's Drive folder.
    const primary = createdJobs[0];
    if (primary) {
      for (const att of m.attachments) {
        const uploaded = await uploadToJobFolder(
          { id: primary.id, reference: primary.reference, title: primary.title },
          att.filename,
          att.data,
          att.mimeType
        );
        if (uploaded) {
          await prisma.document.create({
            data: {
              jobId: primary.id,
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

/** Combines a YYYY-MM-DD date and optional HH:mm time into a Date, or null. */
function combineDateTime(date?: string, time?: string): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = time && /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "08:00";
  const d = new Date(`${date}T${t}:00`);
  return isNaN(d.getTime()) ? null : d;
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
