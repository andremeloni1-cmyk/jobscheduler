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
