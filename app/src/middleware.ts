import { NextResponse, type NextRequest } from "next/server";

// Edge-compatible HMAC verification of the session cookie.
async function validCookie(value: string | undefined, secret: string): Promise<boolean> {
  if (!value) return false;
  const idx = value.lastIndexOf(".");
  if (idx < 0) return false;
  const payload = value.slice(0, idx);
  const sig = value.slice(idx + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === sig;
}

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // No password configured → no login gate.
  if (!password) return NextResponse.next();

  const secret = process.env.SESSION_SECRET || "dev-insecure-secret";
  const cookie = req.cookies.get("jf_session")?.value;
  if (await validCookie(cookie, secret)) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // Gate everything except the login page, the login API, and static assets.
  matcher: ["/((?!login|api/auth/login|api/branding|api/leads/scan|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
