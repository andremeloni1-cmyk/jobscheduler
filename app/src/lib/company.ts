import { prisma } from "@/lib/db";

/** Builds a resolver that maps a job to its client-company display name.
 * Prefers the explicit companyId, then falls back to matching the lead-source
 * sender domain. Returns null when a job has no company. */
export async function companyResolver(): Promise<(job: { companyId?: string | null; leadSource?: string | null }) => string | null> {
  const sources = await prisma.leadSource.findMany();
  const byId = new Map(sources.map((s) => [s.id, s.displayName || s.name]));
  return (job) => {
    if (job.companyId && byId.has(job.companyId)) return byId.get(job.companyId) || null;
    if (job.leadSource) {
      const ls = job.leadSource.toLowerCase();
      const s = sources.find((x) => ls.includes(x.email.toLowerCase()));
      if (s) return s.displayName || s.name;
    }
    return null;
  };
}
