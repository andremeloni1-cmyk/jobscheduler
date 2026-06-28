import { json, parseDate } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { listEvents } from "@/lib/google/calendar";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAuthenticated()) return json({ error: "unauthorized" }, 401);
  const { searchParams } = new URL(req.url);
  const start = parseDate(searchParams.get("start"));
  const end = parseDate(searchParams.get("end"));
  if (!start || !end) return json({ error: "start and end are required" }, 400);

  const events = await listEvents(start, end);
  if (events === null) return json({ connected: false, events: [] });
  return json({ connected: true, events });
}
