// Standard installer working day. Jobs run 6:30am–3:00pm; multi-day jobs spill
// onto the following working days (weekends skipped). Used both server-side
// (calendar sync) and client-side (calendar view), so this file stays pure —
// no prisma / google imports.

export const WORK_START_HOUR = 6;
export const WORK_START_MIN = 30;
export const WORK_END_HOUR = 15;
export const WORK_END_MIN = 0;

/** Minutes in one standard working day (6:30am–3:00pm = 510). */
export const WORKDAY_MINS =
  WORK_END_HOUR * 60 + WORK_END_MIN - (WORK_START_HOUR * 60 + WORK_START_MIN);

/** Business timezone for Google Calendar events. */
export function businessTimeZone(): string {
  return process.env.BUSINESS_TZ || "Australia/Sydney";
}

// Job times are a fixed "wall clock" stored in UTC (e.g. 06:30 == 06:30Z),
// so all day/time maths here use UTC components. This makes scheduling
// identical on the server and in any browser, regardless of their timezone.
function atWorkStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(WORK_START_HOUR, WORK_START_MIN, 0, 0);
  return x;
}
function atWorkEnd(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(WORK_END_HOUR, WORK_END_MIN, 0, 0);
  return x;
}
function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}
/** A UTC-midnight date `n` days after the given date (wall-clock day maths). */
function addUTCDays(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}

export type DaySegment = { start: Date; end: Date };

/**
 * Splits a job into one segment per working day (6:30am–3:00pm), starting on the
 * job's start date. The first day honours the job's actual start time; later
 * days run a full work day. The last day ends when the remaining work is done.
 * Weekends are skipped. Always returns at least one segment.
 */
export function workdaySegments(start: Date, durationMins?: number | null): DaySegment[] {
  const total = Math.max(15, Math.round(durationMins && durationMins > 0 ? durationMins : WORKDAY_MINS));
  const segments: DaySegment[] = [];
  let remaining = total;
  let cursor = new Date(start);
  let first = true;

  for (let guard = 0; guard < 90 && remaining > 0; guard++) {
    if (isWeekend(cursor)) {
      cursor = atWorkStart(addUTCDays(cursor, 1));
      continue;
    }
    const segStart = first ? new Date(cursor) : atWorkStart(cursor);
    const dayEnd = atWorkEnd(segStart);
    const availMins = Math.max(0, (dayEnd.getTime() - segStart.getTime()) / 60_000);
    if (availMins <= 0) {
      // Start time was at/after end of day — push to next day.
      cursor = atWorkStart(addUTCDays(segStart, 1));
      first = false;
      continue;
    }
    const use = Math.min(remaining, availMins);
    segments.push({ start: segStart, end: new Date(segStart.getTime() + use * 60_000) });
    remaining -= use;
    first = false;
    cursor = atWorkStart(addUTCDays(segStart, 1));
  }

  if (segments.length === 0) {
    const s = new Date(start);
    segments.push({ start: s, end: new Date(s.getTime() + total * 60_000) });
  }
  return segments;
}

/** Overall end of a job (end of its last working-day segment). */
export function jobEnd(start: Date, durationMins?: number | null): Date {
  const segs = workdaySegments(start, durationMins);
  return segs[segs.length - 1].end;
}

/** True if two time intervals overlap (touching edges don't count). */
export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
