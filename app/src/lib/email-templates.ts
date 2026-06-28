import { prisma } from "@/lib/db";

export type TemplateVars = Record<string, string>;

function fmtDate(d?: Date | null): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtTime(d?: Date | null): string {
  if (!d) return "TBC";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function jobTemplateVars(job: {
  title: string;
  reference: string;
  address?: string | null;
  clientName?: string | null;
  scheduledStart?: Date | null;
}, ownerName: string): TemplateVars {
  return {
    jobTitle: job.title,
    reference: job.reference,
    address: job.address || "TBC",
    clientName: job.clientName || "there",
    startDate: fmtDate(job.scheduledStart),
    startTime: fmtTime(job.scheduledStart),
    ownerName,
  };
}

export function render(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

/** Loads a template by key and renders subject + body with the given vars. */
export async function renderTemplate(
  key: string,
  vars: TemplateVars
): Promise<{ subject: string; body: string; enabled: boolean } | null> {
  const t = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!t) return null;
  return {
    subject: render(t.subject, vars),
    body: render(t.body, vars),
    enabled: t.enabled,
  };
}

/**
 * Resolves the email for a specific job: starts from the global template, applies
 * any per-company (lead-source) override, then appends the account signature.
 */
export async function resolveTemplate(
  job: { leadSource?: string | null },
  key: string,
  vars: TemplateVars
): Promise<{ subject: string; body: string; enabled: boolean } | null> {
  const global = await prisma.emailTemplate.findUnique({ where: { key } });
  if (!global) return null;
  let subject = global.subject;
  let body = global.body;

  // Per-company override (matched by the job's sender against the lead source).
  if (job.leadSource) {
    const ls = job.leadSource.toLowerCase();
    const sources = await prisma.leadSource.findMany();
    const src = sources.find((s) => ls.includes(s.email.toLowerCase()));
    if (src?.templates) {
      try {
        const ov = (JSON.parse(src.templates) || {})[key];
        if (ov?.subject) subject = ov.subject;
        if (ov?.body) body = ov.body;
      } catch {
        /* ignore malformed overrides */
      }
    }
  }

  let outBody = render(body, vars);
  const account = await prisma.account.findFirst();
  const sig = account?.signature?.trim();
  if (sig) outBody += `\n\n${render(sig, vars)}`;

  return { subject: render(subject, vars), body: outBody, enabled: global.enabled };
}
