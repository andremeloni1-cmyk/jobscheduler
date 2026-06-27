import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE = "jf_session";

function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret";
}

function sign(value: string): string {
  const h = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  return `${value}.${h}`;
}

function verify(signed: string | undefined): boolean {
  if (!signed) return false;
  const idx = signed.lastIndexOf(".");
  if (idx < 0) return false;
  const value = signed.slice(0, idx);
  return sign(value) === signed;
}

/** Whether a login gate is configured at all. */
export function passwordRequired(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}

export function checkPassword(pw: string): boolean {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) return true;
  // constant-time compare
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function setSessionCookie() {
  cookies().set(COOKIE, sign("ok"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

/** True when the request is allowed (no gate, or valid cookie). */
export function isAuthenticated(): boolean {
  if (!passwordRequired()) return true;
  return verify(cookies().get(COOKIE)?.value);
}
