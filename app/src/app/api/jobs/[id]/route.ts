import { prisma } from "@/lib/db";
import { json, parseDate } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { onStatusChange, onReschedule, removeCalendar } from "@/lib/automations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const job = await prisma.job.findUnique({
    where: { id: (await params).id },
    include: {
      documents: { orderBy: { createdAt: "desc" } },
      reports: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!job) return json({ error: "not found" }, 404);
  return json({ job });
}

export async function PATCH(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const existing = await prisma.job.findUnique({ where: { id: (await params).id } });
  if (!existing) return json({ error: "not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  for (const f of ["title", "description", "address", "clientName", "clientEmail", "clientPhone", "priority", "notes", "currency"]) {
    if (f in body) data[f] = body[f] || null;
  }
  if ("quoteAmount" in body) data.quoteAmount = body.quoteAmount != null ? Number(body.quoteAmount) : null;
  if ("durationMins" in body) data.durationMins = Number(body.durationMins) || existing.durationMins;
  if ("flag" in body) data.flag = body.flag || null; // clear/set the review flag

  const timeChanged =
    ("scheduledStart" in body || "scheduledEnd" in body);
  if ("scheduledStart" in body) data.scheduledStart = parseDate(body.scheduledStart);
  if ("scheduledEnd" in body) data.scheduledEnd = parseDate(body.scheduledEnd);

  const statusChanged = "status" in body && body.status !== existing.status;
  if (statusChanged) data.status = body.status;

  const job = await prisma.job.update({ where: { id: (await params).id }, data });

  // Run automations after persisting.
  if (statusChanged) {
    await onStatusChange(job, existing.status).catch(() => {});
  } else if (timeChanged && ["accepted", "scheduled", "in_progress"].includes(job.status)) {
    // Feature 2: a "move" — only notify when explicitly requested.
    await onReschedule(job, body.notify !== false).catch(() => {});
  }

  return json({ job });
}

export async function DELETE(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const id = (await params).id;
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) return json({ error: "not found" }, 404);

  // Deleting always clears the calendar event.
  await removeCalendar(existing).catch(() => {});

  // ?hard=1 → permanent (used by "Delete forever" in Recently deleted).
  // Otherwise soft-delete: hide it but keep it restorable for 30 days.
  const hard = new URL(req.url).searchParams.get("hard") === "1";
  if (hard) {
    await prisma.job.delete({ where: { id } });
  } else {
    await prisma.job.update({ where: { id }, data: { deletedAt: new Date() } });
  }
  return json({ ok: true });
}
