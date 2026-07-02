import { NextResponse } from "next/server";
import { authUrl, googleConfigured } from "@/lib/google/oauth";
import { isAuthenticated } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.redirect(new URL("/login", process.env.APP_URL || "http://localhost:3000"));
  if (!googleConfigured()) {
    return NextResponse.redirect(
      new URL("/settings?error=google_not_configured", process.env.APP_URL || "http://localhost:3000")
    );
  }
  return NextResponse.redirect(await authUrl());
}
