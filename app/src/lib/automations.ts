import { prisma } from "@/lib/db";
import { upsertJobEvent, deleteJobEvent } from "@/lib/google/calendar";
import { sendEmail } from "@/lib/google/gmail";
import { findJobPdfAttachments } from "@/lib/google/gmail";
import { uploadToJobFolder } from "@/lib/google/drive";
import { isGoogleConnected } from "@/lib/google/oauth";
import { jobTemplateVars, renderTemplate } from "@/lib/email-templates";
import { isScheduledStatus } from "@/lib/types";
import type { Job } from "@prisma/client";

async function ownerName(): Promise<string> {
  const a = await prisma.account.findFirst();
  return a?.name || "The Workshop";
}

export async function logActivity(
  jobId: string | null,
  type: string,
  message: string,
  meta: Record<string, unknown> = {}
) {
  await prisma.activity.create({
    data: { jobId: jobId ?? undefined, type, message, meta: JSON.stringify(meta) },
  });
}

/** Drive web links for a job's saved documents (for the calendar description). */
async function jobDocLinks(jobId: string): Promise<string[]> {
  const docs = await prisma.document.findMany({
    where: { jobId, webViewLink: { not: null } },
  });
  return docs.map((d) => `${d.name}: ${d.webViewLink}`);
}

/**
 * Feature 1 + 3: ensure a calendar event exists for a scheduled job, with the
 * job's Drive document links embedded so they open from the event.
 */
function parseEventIds(job: Job): string[] {
  const ids: string[] = [];
  if (job.googleEventIds) {
    try {
      const arr = JSON.parse(job.googleEventIds);
      if (Array.isArray(arr)) ids.push(...arr.filter((x) => typeof x === "string"));
    } catch {
      /* ignore */
    }
  }
  if (job.googleEventId && !ids.includes(job.googleEventId)) ids.push(job.googleEventId);
  return ids;
}

export async function syncCalendar(job: Job): Promise<void> {
  if (!isScheduledStatus(job.status)) return;
  // Don't put undated jobs on the calendar — wait until a start time is set.
  if (!job.scheduledStart) {
    await logActivity(job.id, "calendar", "Accepted — add a date to put it on the calendar");
    return;
  }
  const links = await jobDocLinks(job.id);
  const previousIds = parseEventIds(job);
  const eventIds = await upsertJobEvent(job, links, previousIds);
  if (eventIds && eventIds.length > 0) {
    await prisma.job.update({
      where: { id: job.id },
      data: { googleEventId: eventIds[0], googleEventIds: JSON.stringify(eventIds) },
    });
    const wasNew = previousIds.length === 0;
    const note =
      eventIds.length > 1
        ? `${wasNew ? "Added" : "Updated"} Google Calendar — ${eventIds.length} working days`
        : wasNew
          ? "Added to Google Calendar"
          : "Updated Google Calendar event";
    await logActivity(job.id, "calendar", note, { eventIds });
  } else {
    await logActivity(job.id, "calendar", "Scheduled (demo mode — connect Google to sync)");
  }
}

export async function removeCalendar(job: Job): Promise<void> {
  const ids = parseEventIds(job);
  if (ids.length === 0) return;
  const ok = await deleteJobEvent(ids);
  await prisma.job.update({ where: { id: job.id }, data: { googleEventId: null, googleEventIds: null } });
  await logActivity(job.id, "calendar", ok ? "Removed from Google Calendar" : "Calendar event cleared");
}

/**
 * Feature 4: send a templated client email for accepted / moved / cancelled.
 */
export async function sendClientEmail(job: Job, key: "accepted" | "moved" | "cancelled"): Promise<void> {
  if (!job.clientEmail) {
    await logActivity(job.id, "email", `No client email on file — ${key} notice not sent`);
    return;
  }
  const tpl = await renderTemplate(key, jobTemplateVars(job, await ownerName()));
  if (!tpl || !tpl.enabled) return;

  const sent = await sendEmail({ to: job.clientEmail, subject: tpl.subject, body: tpl.body });
  await logActivity(
    job.id,
    "email",
    sent
      ? `Sent "${key}" email to ${job.clientEmail}`
      : `Drafted "${key}" email (demo mode — connect Google to send)`,
    { key, to: job.clientEmail }
  );
}

/**
 * Feature 3: pull job-related PDFs from Gmail into the job's Drive folder and
 * record them as documents. Returns the number of new documents saved.
 */
export async function syncJobPdfs(job: Job): Promise<number> {
  const attachments = await findJobPdfAttachments({
    reference: job.reference,
    clientEmail: job.clientEmail,
    title: job.title,
  });
  let saved = 0;
  for (const att of attachments) {
    // Skip ones already saved (match by name).
    const exists = await prisma.document.findFirst({
      where: { jobId: job.id, name: att.filename },
    });
    if (exists) continue;

    const uploaded = await uploadToJobFolder(job, att.filename, att.data, att.mimeType);
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
      saved++;
    }
  }
  if (saved > 0) {
    await logActivity(job.id, "drive", `Saved ${saved} PDF(s) from email to Google Drive`);
    // Refresh the calendar event so the new links appear on it.
    const fresh = await prisma.job.findUnique({ where: { id: job.id } });
    if (fresh) await syncCalendar(fresh);
  }
  return saved;
}

/**
 * Orchestrates everything that should happen when a job's status changes.
 */
export async function onStatusChange(
  job: Job,
  previousStatus: string
): Promise<void> {
  if (job.status === previousStatus) return;
  await logActivity(job.id, "status_change", `Status: ${previousStatus} → ${job.status}`);

  switch (job.status) {
    case "accepted":
    case "scheduled":
    case "in_progress":
    case "completed": {
      await syncCalendar(job);
      if (job.status === "accepted") {
        await sendClientEmail(job, "accepted");
        // Best-effort: grab any job PDFs already sitting in the inbox.
        if (await isGoogleConnected()) {
          try {
            await syncJobPdfs(job);
          } catch {
            /* non-fatal */
          }
        }
      }
      break;
    }
    case "cancelled": {
      await removeCalendar(job);
      await sendClientEmail(job, "cancelled");
      break;
    }
    default:
      break;
  }
}

/**
 * Feature 2: when a scheduled job is moved (time changed), update the calendar
 * and notify the client.
 */
export async function onReschedule(job: Job, notify = true): Promise<void> {
  await syncCalendar(job);
  if (notify) await sendClientEmail(job, "moved");
}
