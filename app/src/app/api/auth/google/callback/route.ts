import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { newOAuthClient, OAUTH_STATE_COOKIE } from "@/lib/google/oauth";
import { prisma } from "@/lib/db";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function GET(req: Request) {
  const base = process.env.APP_URL || "http://localhost:3000";
  if (!(await isAuthenticated())) return NextResponse.redirect(new URL("/login", base));

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?error=no_code", base));

  // CSRF: match the returned state against the cookie set in authUrl(), then
  // clear it. Reject before exchanging the code for tokens.
  const store = await cookies();
  const expectedState = store.get(OAUTH_STATE_COOKIE)?.value || "";
  const state = searchParams.get("state") || "";
  store.delete(OAUTH_STATE_COOKIE);
  if (!expectedState || !safeEqual(state, expectedState)) {
    return NextResponse.redirect(new URL("/settings?error=bad_state", base));
  }

  try {
    const client = newOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Look up the connected Google account's email.
    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const me = await oauth2.userinfo.get();
    const googleEmail = me.data.email || undefined;

    const ownerEmail = process.env.OWNER_EMAIL || googleEmail || "owner@example.com";
    const account =
      (await prisma.account.findFirst()) ??
      (await prisma.account.create({ data: { email: ownerEmail } }));

    await prisma.account.update({
      where: { id: account.id },
      data: {
        googleAccessToken: tokens.access_token || null,
        googleRefreshToken: tokens.refresh_token || account.googleRefreshToken || null,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        googleEmail,
        name: account.name || me.data.name || "Workshop Owner",
      },
    });

    return NextResponse.redirect(new URL("/settings?connected=1", base));
  } catch (e) {
    return NextResponse.redirect(new URL("/settings?error=oauth_failed", base));
  }
}
