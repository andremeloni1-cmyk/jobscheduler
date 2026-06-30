import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { generateChecklist } from "@/lib/checklist-ai";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Draft an on-site to-do list from the job's title + description using AI.
 * Returns plain step strings; the client merges them into the saved checklist.
 * Demo-safe: no-ops with a message when AI isn't configured. */
export async function POST(_req: Request, { params }: Params) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);

  const job = await prisma.job.findUnique({ where: { id: (await params).id } });
  if (!job) return json({ error: "not found" }, 404);

  const items = await generateChecklist({ title: job.title, description: job.description, address: job.address });
  if (items === null) {
    return json({ items: [], message: "AI isn't set up — add a to-do manually, or set ANTHROPIC_API_KEY to auto-draft." });
  }
  if (items.length === 0) {
    return json({ items: [], message: "Couldn't draft a list from this job's details — add a few notes to the description and try again." });
  }
  return json({ items });
}
