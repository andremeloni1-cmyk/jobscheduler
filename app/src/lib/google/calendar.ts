import { google } from "googleapis";
import { getAuthorizedClient } from "./oauth";
import { prisma } from "@/lib/db";

type JobLike = {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  address?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  scheduledStart?: Date | null;
  scheduledEnd?: Date | null;
  durationMins: number;
  googleEventId?: string | null;
};

async function calendarId(): Promise<string> {
  const account = await prisma.account.findFirst();
  return account?.calendarId || "primary";
}

function eventTimes(job: JobLike): { start: Date; end: Date } {
  const start = job.scheduledStart ? new Date(job.scheduledStart) : new Date();
  const end = job.scheduledEnd
    ? new Date(job.scheduledEnd)
    : new Date(start.getTime() + job.durationMins * 60_000);
  return { start, end };
}

function buildDescription(job: JobLike, docLinks: string[] = []): string {
  const lines = [
    job.description || "",
    "",
    `Reference: ${job.reference}`,
    job.clientName ? `Client: ${job.clientName}` : "",
    job.clientEmail ? `Email: ${job.clientEmail}` : "",
    "",
  ];
  if (docLinks.length) {
    lines.push("📎 Job documents:");
    docLinks.forEach((l) => lines.push(l));
  }
  lines.push("", `Managed by JoineryFlow • ${process.env.APP_URL || ""}/jobs/${job.id}`);
  return lines.filter((l) => l !== undefined).join("\n");
}

/**
 * Creates (or updates if one already exists) a Google Calendar event for a job.
 * Returns the event id, or null in demo mode (Google not connected).
 */
export async function upsertJobEvent(
  job: JobLike,
  docLinks: string[] = []
): Promise<string | null> {
  const auth = await getAuthorizedClient();
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth });
  const calId = await calendarId();
  const { start, end } = eventTimes(job);

  const requestBody = {
    summary: `🔨 ${job.title}`,
    description: buildDescription(job, docLinks),
    location: job.address || undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { joineryflowJobId: job.id } },
  };

  if (job.googleEventId) {
    const res = await calendar.events.update({
      calendarId: calId,
      eventId: job.googleEventId,
      requestBody,
    });
    return res.data.id || job.googleEventId;
  }

  const res = await calendar.events.insert({ calendarId: calId, requestBody });
  return res.data.id || null;
}

export type ExternalEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

/**
 * Lists the owner's existing Google Calendar events in a window, so the app's
 * calendar can show prior commitments when scheduling. Excludes events this app
 * created for jobs (those are already rendered from the DB). Returns null in
 * demo mode (Google not connected).
 */
export async function listEvents(timeMin: Date, timeMax: Date): Promise<ExternalEvent[] | null> {
  const auth = await getAuthorizedClient();
  if (!auth) return null;

  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId: await calendarId(),
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  return (res.data.items || [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => !e.extendedProperties?.private?.joineryflowJobId)
    .map((e) => ({
      id: e.id || "",
      title: e.summary || "(busy)",
      start: e.start?.dateTime || e.start?.date || "",
      end: e.end?.dateTime || e.end?.date || "",
      allDay: Boolean(e.start?.date),
    }))
    .filter((e) => e.start);
}

export async function deleteJobEvent(googleEventId?: string | null): Promise<boolean> {
  if (!googleEventId) return false;
  const auth = await getAuthorizedClient();
  if (!auth) return false;
  const calendar = google.calendar({ version: "v3", auth });
  try {
    await calendar.events.delete({ calendarId: await calendarId(), eventId: googleEventId });
    return true;
  } catch {
    return false; // already gone
  }
}
