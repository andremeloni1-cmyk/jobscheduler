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
  siteContact: string | null; // the homeowner / end customer for this job
  address: string | null;
};

type CompanyAgg = {
  key: string;
  name: string;
  email: string | null;
  jobCount: number;
  activeCount: number;
  totalValue: number;
  currency: string;
  lastActivityAt: string;
  jobs: ClientJob[];
};

const ACTIVE = (s: string) => !["completed", "cancelled"].includes(s);

/**
 * "Clients" are the joinery companies the owner works for. Each job is grouped
 * by its company (explicit companyId, else matched from the lead-source sender
 * domain). The end customer/homeowner is kept per-job as the site contact.
 * All enabled companies appear even with no jobs yet.
 */
export async function GET() {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);

  const [jobs, sources] = await Promise.all([
    prisma.job.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } }),
    prisma.leadSource.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const byId = new Map(sources.map((s) => [s.id, s]));
  const matchDomain = (lead?: string | null) =>
    lead ? sources.find((s) => lead.toLowerCase().includes(s.email.toLowerCase())) : undefined;

  const map = new Map<string, CompanyAgg>();
  // Seed enabled companies so they always show up as clients.
  for (const s of sources) {
    if (!s.enabled) continue;
    map.set(s.id, {
      key: s.id,
      name: s.displayName || s.name,
      email: s.email,
      jobCount: 0,
      activeCount: 0,
      totalValue: 0,
      currency: "AUD",
      lastActivityAt: "",
      jobs: [],
    });
  }

  for (const j of jobs) {
    const src = (j.companyId && byId.get(j.companyId)) || matchDomain(j.leadSource);
    const key = src ? src.id : "direct";
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        name: src ? src.displayName || src.name : "Direct / other",
        email: src?.email || null,
        jobCount: 0,
        activeCount: 0,
        totalValue: 0,
        currency: j.currency || "AUD",
        lastActivityAt: "",
        jobs: [],
      };
      map.set(key, c);
    }
    c.jobCount += 1;
    if (ACTIVE(j.status)) c.activeCount += 1;
    if (j.status !== "cancelled" && j.quoteAmount) c.totalValue += j.quoteAmount;
    const when = (j.scheduledStart || j.createdAt).toISOString();
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
      siteContact: j.clientName || null,
      address: j.address || null,
    });
  }

  // Most active first; companies with no jobs sink to the bottom.
  const clients = [...map.values()].sort(
    (a, b) => b.jobCount - a.jobCount || b.lastActivityAt.localeCompare(a.lastActivityAt)
  );
  return json({ clients });
}
