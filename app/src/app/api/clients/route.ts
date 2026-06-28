import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

type ClientJob = {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  quoteAmount: number | null;
  currency: string;
};

type ClientAgg = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  leadSource: string | null;
  jobCount: number;
  activeCount: number;
  totalValue: number;
  currency: string;
  lastActivityAt: string;
  jobs: ClientJob[];
};

const ACTIVE = (s: string) => !["completed", "cancelled"].includes(s);

/**
 * Clients are derived from jobs (grouped by email, falling back to name) since
 * jobs carry the denormalised client details. This means the list is always
 * populated from real data — including leads imported from email.
 */
export async function GET() {
  if (!isAuthenticated()) return json({ error: "unauthorized" }, 401);

  const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });

  const map = new Map<string, ClientAgg>();
  for (const j of jobs) {
    const key = (j.clientEmail || j.clientName || "").trim().toLowerCase();
    if (!key) continue; // skip jobs with no client identity at all

    const when = (j.scheduledStart || j.createdAt).toISOString();
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        name: j.clientName || j.clientEmail || "Unnamed client",
        email: j.clientEmail || null,
        phone: j.clientPhone || null,
        address: j.address || null,
        leadSource: j.leadSource || null,
        jobCount: 0,
        activeCount: 0,
        totalValue: 0,
        currency: j.currency || "AUD",
        lastActivityAt: when,
        jobs: [],
      };
      map.set(key, c);
    }

    c.jobCount += 1;
    if (ACTIVE(j.status)) c.activeCount += 1;
    if (j.status !== "cancelled" && j.quoteAmount) c.totalValue += j.quoteAmount;
    // Jobs are pre-sorted newest-first, so the first non-null we see is the most
    // recent — only fill gaps, never overwrite a fresher value.
    if (!c.phone && j.clientPhone) c.phone = j.clientPhone;
    if (!c.address && j.address) c.address = j.address;
    if (!c.email && j.clientEmail) c.email = j.clientEmail;
    if (!c.leadSource && j.leadSource) c.leadSource = j.leadSource;
    if (when > c.lastActivityAt) c.lastActivityAt = when;

    c.jobs.push({
      id: j.id,
      reference: j.reference,
      title: j.title,
      status: j.status,
      scheduledStart: j.scheduledStart,
      scheduledEnd: j.scheduledEnd,
      quoteAmount: j.quoteAmount,
      currency: j.currency,
    });
  }

  const clients = [...map.values()].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  return json({ clients });
}
