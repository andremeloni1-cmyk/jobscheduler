import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { ensureDefaultLeadSources } from "@/lib/leads";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  await ensureDefaultLeadSources();
  const sources = await prisma.leadSource.findMany({ orderBy: { createdAt: "asc" } });
  return json({ sources });
}

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  // Accept either a full email address or a bare company domain.
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isDomain = /^[^\s@]+\.[^\s@]+$/.test(email);
  if (!isEmail && !isDomain) {
    return json({ error: "Enter a valid email address or company domain" }, 400);
  }

  // One company = one row. If a source for the same email domain already exists
  // (e.g. a bare domain plus a specific address), reuse it instead of creating a
  // duplicate that would show as a second client card.
  const domain = email.split("@").pop() || email;
  const existing = (await prisma.leadSource.findMany()).find(
    (s) => (s.email.toLowerCase().split("@").pop() || s.email.toLowerCase()) === domain
  );
  if (existing) {
    const source = await prisma.leadSource.update({
      where: { id: existing.id },
      data: { name: body.name || existing.name, enabled: true },
    });
    return json({ source }, 200);
  }

  const source = await prisma.leadSource.create({ data: { email, name: body.name || email } });
  return json({ source }, 201);
}
