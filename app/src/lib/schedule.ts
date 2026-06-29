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
 * job's start date. The number of days is `ceil(duration / one work day)`, so
 * "1 day" is always one day-cell regardless of the start time (a late start no
 * longer spills a few minutes onto an extra day). The first day honours the
 * job's actual start time; later days start at 6:30am; the last day ends when
 * the remaining work is done. Weekends are skipped.
 */
export function workdaySegments(start: Date, durationMins?: number | null): DaySegment[] {
  const total = Math.max(15, Math.round(durationMins && durationMins > 0 ? durationMins : WORKDAY_MINS));
  const days = Math.max(1, Math.ceil(total / WORKDAY_MINS));
  const segments: DaySegment[] = [];
  let remaining = total;
  let cursor = new Date(start);

  for (let i = 0; i < days; i++) {
    while (isWeekend(cursor)) cursor = atWorkStart(addUTCDays(cursor, 1));
    const segStart = i === 0 ? new Date(cursor) : atWorkStart(cursor);
    const mins = Math.min(remaining, WORKDAY_MINS);
    segments.push({ start: segStart, end: new Date(segStart.getTime() + mins * 60_000) });
    remaining -= mins;
    cursor = atWorkStart(addUTCDays(segStart, 1));
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
