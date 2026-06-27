import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { isGoogleConnected, googleConfigured } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticated()) return json({ error: "unauthorized" }, 401);
  const account = await prisma.account.findFirst();
  const templates = await prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
  return json({
    account: account
      ? {
          name: account.name,
          email: account.email,
          googleEmail: account.googleEmail,
          calendarId: account.calendarId,
        }
      : null,
    templates,
    google: {
      configured: googleConfigured(),
      connected: await isGoogleConnected(),
    },
  });
}

export async function PATCH(req: Request) {
  if (!isAuthenticated()) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  if (body.account) {
    const account = await prisma.account.findFirst();
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          name: body.account.name ?? account.name,
          calendarId: body.account.calendarId ?? account.calendarId,
        },
      });
    }
  }

  if (Array.isArray(body.templates)) {
    for (const t of body.templates) {
      if (!t.key) continue;
      await prisma.emailTemplate.update({
        where: { key: t.key },
        data: {
          subject: t.subject,
          body: t.body,
          enabled: t.enabled ?? true,
        },
      });
    }
  }

  return json({ ok: true });
}
