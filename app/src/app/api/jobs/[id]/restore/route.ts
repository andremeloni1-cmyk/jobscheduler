import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { syncCalendar, logActivity } from "@/lib/automations";

export const dynamic = "force-dynamic";

// Restore a soft-deleted job: un-bin it and re-add its calendar event if it's
// still scheduled.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const id = (await params).id;
  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing) return json({ error: "not found" }, 404);

  const job = await prisma.job.update({ where: { id }, data: { deletedAt: null } });
  await logActivity(job.id, "note", "Restored from Recently deleted");
  await syncCalendar(job).catch(() => {});
  return json({ ok: true, job });
}
