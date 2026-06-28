import { prisma } from "@/lib/db";
import { findLeadMessages } from "@/lib/google/gmail";
import { uploadToJobFolder } from "@/lib/google/drive";
import { isGoogleConnected } from "@/lib/google/oauth";
import { logActivity } from "@/lib/automations";
import { nextReference } from "@/lib/utils";
import { analyzeJobImages, visionConfigured } from "@/lib/vision";

const IMAGE_RE = /^image\//i;

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
    const exists = await prisma.job.findUnique({ where: { gmailMessageId: m.messageId } });
    if (exists) continue;

    let title = m.subject.replace(/^(re:|fwd:)\s*/i, "").trim() || "New enquiry";
    let description = (m.body || m.snippet || "").slice(0, 1500);

    // Feature: read image attachments (e.g. mii Kitchens' PNG job sheets) with
    // AI vision and fold the extracted details into the lead.
    const imageAttachments = m.attachments.filter((a) => IMAGE_RE.test(a.mimeType));
    if (imageAttachments.length > 0 && visionConfigured()) {
      const read = await analyzeJobImages(
        imageAttachments.map((a) => ({ filename: a.filename, data: a.data, mimeType: a.mimeType }))
      );
      if (read) {
        if (read.title && (!title || title === "New enquiry")) title = read.title;
        description = [read.description, description && `— Email —\n${description}`]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 4000);
      }
    }

    const job = await prisma.job.create({
      data: {
        reference: await nextReference(),
        title,
        description,
        status: "lead",
        clientName: m.fromName,
        clientEmail: m.fromEmail,
        leadSource: m.fromEmail,
        gmailMessageId: m.messageId,
        gmailThreadId: m.threadId,
      },
    });

    if (imageAttachments.length > 0 && visionConfigured()) {
      await logActivity(job.id, "lead", `Read ${imageAttachments.length} image(s) with AI to extract job details`);
    }

    // File any attached PDFs into the job's Drive folder.
    for (const att of m.attachments) {
      const uploaded = await uploadToJobFolder(
        { id: job.id, reference: job.reference, title: job.title },
        att.filename,
        att.data,
        att.mimeType
      );
      if (uploaded) {
        await prisma.document.create({
          data: {
            jobId: job.id,
            name: uploaded.name,
            driveFileId: uploaded.fileId,
            webViewLink: uploaded.webViewLink,
            source: "gmail",
            mimeType: uploaded.mimeType,
          },
        });
      }
    }

    await logActivity(
      job.id,
      "lead",
      `Imported from email — ${m.fromName} <${m.fromEmail}>`,
      { messageId: m.messageId, attachments: m.attachments.length }
    );
    created++;
  }

  return { created, connected: true };
}

const DEFAULT_SOURCES = [
  { name: "mii Kitchens", email: "emily@miikitchen.com.au" },
  { name: "Harrington Kitchens", email: "service@harringtonkitchens.com.au" },
  { name: "Peter Baldwin (Ingenuity Joinery)", email: "peter.baldwin@ingenuityjoinery.com" },
];

/** Ensures the user's three default trusted senders exist (idempotent). */
export async function ensureDefaultLeadSources(): Promise<void> {
  for (const s of DEFAULT_SOURCES) {
    await prisma.leadSource.upsert({
      where: { email: s.email },
      update: {},
      create: s,
    });
  }
}
