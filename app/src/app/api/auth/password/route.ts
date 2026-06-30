import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated, checkPassword, hashPassword } from "@/lib/session";

export const dynamic = "force-dynamic";

// Change the app login password. Stores a scrypt hash on the Account, which then
// takes precedence over APP_PASSWORD. Requires a valid session and the current
// password (when one is already set).
export async function POST(req: Request) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body.newPassword === "string" ? body.newPassword : "";

  if (next.length < 6) return json({ error: "New password must be at least 6 characters." }, 400);

  // Verify the current password. If none is set yet (no hash, no APP_PASSWORD),
  // checkPassword returns true and the owner can set an initial password.
  if (!(await checkPassword(current))) return json({ error: "Current password is incorrect." }, 400);

  let account = await prisma.account.findFirst();
  if (!account) {
    account = await prisma.account.create({ data: { email: process.env.OWNER_EMAIL || "owner@joineryflow.local" } });
  }
  await prisma.account.update({ where: { id: account.id }, data: { passwordHash: hashPassword(next) } });

  return json({ ok: true });
}
