import { NextResponse, type NextRequest } from "next/server";

const MAX_AGE_MS = 60 * 60 * 24 * 30 * 1000; // must match session.ts MAX_AGE

// Constant-time hex-string compare (Web Crypto has no timingSafeEqual on Edge).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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
  if (!timingSafeEqualHex(expected, sig)) return false;
  // Reject expired tokens (payload is "<sid>.<issuedAtMs>"); mirrors session.ts.
  const iat = Number(payload.split(".")[1]);
  if (!Number.isFinite(iat)) return false;
  return Date.now() - iat < MAX_AGE_MS;
}

export async function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  // The gate is active if a shared password is configured OR an in-app password
  // has been set — the latter signalled by the jf_gate cookie, since Edge
  // middleware can't read the DB. (API routes remain the real auth boundary.)
  const gateFlag = req.cookies.get("jf_gate")?.value === "1";
  if (!password && !gateFlag) return NextResponse.next();

  // Fail closed: without a secret we can't verify sessions, so force login
  // rather than falling back to a guessable default.
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.redirect(new URL("/login", req.url));

  const cookie = req.cookies.get("jf_session")?.value;
  if (await validCookie(cookie, secret)) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  // Gate everything except the login page, the login API, and static assets.
  matcher: ["/((?!login|api/auth/login|api/branding|api/leads/scan|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon.svg).*)"],
};
