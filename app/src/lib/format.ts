// Client-safe formatting helpers.

export function fmtMoney(amount?: number | null, currency = "AUD"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amount);
}

// Job times are a fixed wall-clock stored in UTC (06:30 == 06:30Z), so format
// them in UTC — 6:30am then reads as 6:30am for everyone, regardless of the
// viewer's device timezone.
export function fmtDay(d?: string | Date | null): string {
  if (!d) return "Unscheduled";
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function fmtTime(d?: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function fmtRange(start?: string | Date | null, end?: string | Date | null): string {
  if (!start) return "Unscheduled";
  const s = fmtTime(start);
  const e = end ? fmtTime(end) : "";
  return e ? `${s}–${e}` : s;
}

// Value for a <input type="datetime-local"> — the job's UTC wall-clock as
// "YYYY-MM-DDTHH:mm". Pair with `fromLocalInput` when saving so the round-trip
// stays in the same (UTC wall-clock) convention.
export function toLocalInput(d?: string | Date | null): string {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 16);
}

// Parse a datetime-local input value ("YYYY-MM-DDTHH:mm") back into a Date,
// treating the entered wall-clock as UTC (matching how job times are stored).
export function fromLocalInput(v: string): Date {
  return new Date(`${v}:00Z`);
}

export function relativeTime(d?: string | Date | null): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}
