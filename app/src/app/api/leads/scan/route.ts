import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { scanForLeads } from "@/lib/leads";

export const dynamic = "force-dynamic";

// Allow either a logged-in user (manual "Check now") or the cron job
// (presents the shared CRON_SECRET) to trigger an inbox scan.
function authorized(req: Request): boolean {
  if (isAuthenticated()) return true;
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

export async function POST(req: Request) {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  try {
    const result = await scanForLeads();
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "scan failed" }, 500);
  }
}
