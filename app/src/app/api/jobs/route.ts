import { prisma } from "@/lib/db";
import { json, nextReference, parseDate } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { onStatusChange } from "@/lib/automations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const scheduled = searchParams.get("scheduled");
  const deleted = searchParams.get("deleted") === "1";

  // "Recently deleted" view: purge anything binned over 30 days ago, then list
  // the rest (newest-deleted first). Default view excludes deleted jobs.
  if (deleted) {
    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    await prisma.job.deleteMany({ where: { deletedAt: { lt: cutoff } } });
    const jobs = await prisma.job.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    });
    return json({ jobs });
  }

  const where: Record<string, unknown> = { deletedAt: null };
  if (status) where.status = status;
  if (scheduled === "1") where.scheduledStart = { not: null };

  const jobs = await prisma.job.findMany({
    where,
    orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
    include: {
      documents: true,
      reports: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true, sentAt: true, updatedAt: true, data: true },
      },
      _count: { select: { reports: true } },
    },
  });
  return json({ jobs });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  if (!body.title || typeof body.title !== "string") {
    return json({ error: "title is required" }, 400);
  }

  const reference = body.reference || (await nextReference());
  const status = body.status || "lead";

  const job = await prisma.job.create({
    data: {
      reference,
      title: body.title,
      description: body.description || null,
      status,
      priority: body.priority || "normal",
      address: body.address || null,
      clientName: body.clientName || null,
      clientEmail: body.clientEmail || null,
      clientPhone: body.clientPhone || null,
      quoteAmount: body.quoteAmount != null ? Number(body.quoteAmount) : null,
      durationMins: body.durationMins ? Number(body.durationMins) : 120,
      scheduledStart: parseDate(body.scheduledStart),
      scheduledEnd: parseDate(body.scheduledEnd),
      notes: body.notes || null,
    },
  });

  // If a job is created already in a confirmed/scheduled state, run automations.
  if (status !== "lead") {
    await onStatusChange(job, "lead").catch(() => {});
  }

  return json({ job }, 201);
}
