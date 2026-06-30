import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { isGoogleConnected, googleConfigured } from "@/lib/google/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const account = await prisma.account.findFirst();
  const templates = await prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
  return json({
    account: account
      ? {
          name: account.name,
          phone: account.phone,
          email: account.email,
          googleEmail: account.googleEmail,
          calendarId: account.calendarId,
          signature: account.signature,
          logo: account.logo,
          logoMime: account.logoMime,
          logoDark: account.logoDark,
          logoDarkMime: account.logoDarkMime,
        }
      : null,
    templates,
    google: {
      configured: googleConfigured(),
      connected: await isGoogleConnected(),
    },
    ai: {
      configured: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  });
}

export async function PATCH(req: Request) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));

  if (body.account) {
    const account = await prisma.account.findFirst();
    if (account) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          name: body.account.name ?? account.name,
          phone: "phone" in body.account ? body.account.phone || null : account.phone,
          calendarId: body.account.calendarId ?? account.calendarId,
          signature: "signature" in body.account ? body.account.signature || null : account.signature,
          logo: "logo" in body.account ? body.account.logo || null : account.logo,
          logoMime: "logoMime" in body.account ? body.account.logoMime || null : account.logoMime,
          logoDark: "logoDark" in body.account ? body.account.logoDark || null : account.logoDark,
          logoDarkMime: "logoDarkMime" in body.account ? body.account.logoDarkMime || null : account.logoDarkMime,
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
