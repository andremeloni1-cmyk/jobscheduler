import { cookies } from "next/headers";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

const COOKIE = "jf_session";
const GATE_COOKIE = "jf_gate";
const MAX_AGE = 60 * 60 * 24 * 30; // session lifetime (seconds)

// Fail closed: never fall back to a guessable default that would make cookies
// forgeable. A missing secret is a misconfiguration, not a dev convenience.
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET must be set");
  return s;
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
  const sig = signed.slice(idx + 1);
  const expected = crypto.createHmac("sha256", secret()).update(value).digest("hex");
  // Constant-time HMAC compare (guard length first — timingSafeEqual throws on mismatch).
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  // Reject expired tokens. Payload is "<sid>.<issuedAtMs>"; old "ok" cookies
  // have no timestamp and are treated as invalid (a fresh login is required).
  const iat = Number(value.split(".")[1]);
  if (!Number.isFinite(iat)) return false;
  return Date.now() - iat < MAX_AGE * 1000;
}

/** Whether a login gate is active: either APP_PASSWORD is set, or the owner has
 * set a password in-app (stored as a hash on the Account). */
export async function passwordIsSet(): Promise<boolean> {
  if (process.env.APP_PASSWORD) return true;
  const account = await prisma.account.findFirst({ select: { passwordHash: true } });
  return Boolean(account?.passwordHash);
}

// --- Password hashing (Node's built-in scrypt — no external dependency). ---
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyHashedPassword(pw: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash, "hex");
  let test: Buffer;
  try {
    test = crypto.scryptSync(pw, salt, 64);
  } catch {
    return false;
  }
  return expected.length === test.length && crypto.timingSafeEqual(expected, test);
}

/** Verify a login attempt. A password set in-app (Account.passwordHash) takes
 * precedence; otherwise fall back to APP_PASSWORD; if neither is set, allow. */
export async function checkPassword(pw: string): Promise<boolean> {
  const account = await prisma.account.findFirst({ select: { passwordHash: true } });
  if (account?.passwordHash) return verifyHashedPassword(pw, account.passwordHash);
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) return true;
  // constant-time compare
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function setSessionCookie() {
  const store = await cookies();
  // Payload carries a random session id + issued-at so cookies aren't a single
  // static forever-valid value; verify() re-checks the timestamp against MAX_AGE.
  const payload = `${crypto.randomBytes(16).toString("hex")}.${Date.now()}`;
  store.set(COOKIE, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Lightweight flag telling the Edge middleware (which has no DB access) that an
 * in-app password gate is active. NOT a security boundary on its own — API
 * routes still enforce isAuthenticated() server-side; this only drives the page
 * redirect to /login when APP_PASSWORD isn't set. */
export async function setGateCookie() {
  const store = await cookies();
  store.set(GATE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearGateCookie() {
  const store = await cookies();
  store.delete(GATE_COOKIE);
}

/** True when the request is allowed (no gate, or valid cookie). */
export async function isAuthenticated(): Promise<boolean> {
  if (!(await passwordIsSet())) return true;
  const store = await cookies();
  return verify(store.get(COOKIE)?.value);
}
