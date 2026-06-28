import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { ensureDefaultLeadSources } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return json({ error: "unauthorized" }, 401);
  await ensureDefaultLeadSources();
  const sources = await prisma.leadSource.findMany({ orderBy: { createdAt: "asc" } });
  return json({ sources });
}

export async function POST(req: Request) {
  if (!isAuthenticated()) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ error: "A valid email is required" }, 400);

  const source = await prisma.leadSource.upsert({
    where: { email },
    update: { name: body.name || email, enabled: true },
    create: { email, name: body.name || email },
  });
  return json({ source }, 201);
}
