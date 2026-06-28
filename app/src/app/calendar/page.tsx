"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { RescheduleModal } from "@/components/RescheduleModal";
import { fmtRange } from "@/lib/format";
import { type JobStatus } from "@/lib/types";
import { api, type JobDTO } from "@/lib/job";

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function startOfMonth(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), 1);
  date.setHours(0, 0, 0, 0);
  return date;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ExternalEvent = { id: string; title: string; start: string; end: string; allDay: boolean };

export default function CalendarPage() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [external, setExternal] = useState<ExternalEvent[]>([]);
  const [calStatus, setCalStatus] = useState<{ connected: boolean; error?: string }>({ connected: false });
  const [mode, setMode] = useState<"month" | "week">("month");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<JobDTO | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { jobs } = await api<{ jobs: JobDTO[] }>("/api/jobs?scheduled=1");
      setJobs(jobs.filter((j) => j.status !== "cancelled"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Pull the owner's existing Google Calendar events for the visible range so
  // prior commitments show up while scheduling.
  useEffect(() => {
    const rangeStart =
      mode === "month" ? startOfWeek(startOfMonth(month)) : new Date(weekStart);
    const rangeEnd = new Date(rangeStart.getTime() + (mode === "month" ? 42 : 7) * 86400000);
    let active = true;
    (async () => {
      try {
        const res = await api<{ connected: boolean; error?: string; events: ExternalEvent[] }>(
          `/api/calendar/events?start=${rangeStart.toISOString()}&end=${rangeEnd.toISOString()}`
        );
        if (!active) return;
        setExternal(res.events || []);
        setCalStatus({ connected: res.connected, error: res.error });
      } catch {
        if (active) {
          setExternal([]);
          setCalStatus({ connected: false });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [mode, month, weekStart]);

  function jobsForDay(day: Date) {
    return jobs
      .filter((j) => j.scheduledStart && sameDay(new Date(j.scheduledStart), day))
      .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
  }

  function externalForDay(day: Date) {
    return external
      .filter((e) => e.start && sameDay(new Date(e.start), day))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  function externalLabel(e: ExternalEvent): string {
    if (e.allDay) return "All day";
    const s = new Date(e.start).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
    return s;
  }

  async function moveJobToDay(job: JobDTO, day: Date) {
    if (!job.scheduledStart) return;
    const old = new Date(job.scheduledStart);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    if (sameDay(old, next)) return;
    const end = new Date(next.getTime() + (job.durationMins || 120) * 60_000);
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, scheduledStart: next.toISOString(), scheduledEnd: end.toISOString() } : j))
    );
    try {
      await api(`/api/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledStart: next.toISOString(), scheduledEnd: end.toISOString(), notify: true }),
      });
      setHint(`Moved "${job.title}" — client notified`);
      setTimeout(() => setHint(null), 2500);
    } catch {
      load();
    }
  }

  async function dropOnDay(day: Date) {
    if (!dragId) return;
    const job = jobs.find((j) => j.id === dragId);
    setDragId(null);
    if (job) await moveJobToDay(job, day);
  }

  const today = new Date();

  // ----- Month grid (6 weeks x 7 days) -----
  const monthCells = useMemo(() => {
    const first = startOfMonth(month);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * 86400000));
  }, [month]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)),
    [weekStart]
  );

  function shiftMonth(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Calendar</h1>
        {/* Mode toggle */}
        <div className="flex rounded-xl bg-stone-100 p-1 text-sm font-semibold">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1 capitalize transition ${
                mode === m ? "bg-white text-brand-700 shadow-sm" : "text-stone-500"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </header>

      {hint && <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{hint}</div>}

      {/* Google Calendar status */}
      {!calStatus.connected ? (
        <div className="mb-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Connect Google in <Link href="/settings" className="font-semibold underline">Settings</Link> to see your existing calendar events here.
        </div>
      ) : calStatus.error ? (
        <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
          Couldn’t load your Google Calendar: {calStatus.error}. Make sure the Calendar API is enabled, then try Disconnect &amp; Connect in Settings.
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-2 text-xs text-stone-400">
          <span className="h-2 w-2 rounded-full bg-sky-400" />
          {external.length > 0
            ? `${external.length} event${external.length > 1 ? "s" : ""} from your Google Calendar shown in this range`
            : "Connected — no other Google Calendar events in this range"}
        </div>
      )}

      {mode === "month" ? (
        <>
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button className="btn-ghost px-2" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-stone-800">
                {month.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
              </span>
              <button
                className="btn-secondary px-2.5 py-1 text-xs"
                onClick={() => {
                  setMonth(startOfMonth(new Date()));
                  const t = new Date();
                  t.setHours(0, 0, 0, 0);
                  setSelectedDay(t);
                }}
              >
                Today
              </button>
            </div>
            <button className="btn-ghost px-2" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
          </div>

          {/* Weekday header */}
          <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-stone-400">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, selectedDay);
              const dayJobs = jobsForDay(day);
              const dayBusy = externalForDay(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOnDay(day)}
                  className={`flex min-h-[3.6rem] flex-col items-center rounded-xl p-1 text-center transition ${
                    isSelected ? "ring-2 ring-brand-500" : ""
                  } ${inMonth ? "bg-white" : "bg-stone-50"} ${dragId ? "ring-1 ring-dashed ring-brand-300" : ""}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                      isToday ? "bg-brand-600 font-bold text-white" : inMonth ? "text-stone-700" : "text-stone-300"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                    {dayJobs.slice(0, 3).map((j) => (
                      <span
                        key={j.id}
                        className={`h-1.5 w-1.5 rounded-full ${dotColor(j.status)}`}
                        title={j.title}
                      />
                    ))}
                    {dayJobs.length > 3 && <span className="text-[9px] leading-none text-stone-400">+{dayJobs.length - 3}</span>}
                    {dayBusy.length > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" title={`${dayBusy.length} calendar event(s)`} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Selected day's jobs */}
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-bold text-stone-700">
              {selectedDay.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
            <DayList
              jobs={jobsForDay(selectedDay)}
              busy={externalForDay(selectedDay)}
              busyLabel={externalLabel}
              onReschedule={setReschedule}
              draggable
              setDragId={setDragId}
            />
          </div>
        </>
      ) : (
        <>
          {/* Week nav */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-stone-500">
              {weekStart.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} –{" "}
              {days[6].toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <div className="flex items-center gap-1">
              <button className="btn-ghost px-2" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))} aria-label="Previous week">‹</button>
              <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setWeekStart(startOfWeek(new Date()))}>This week</button>
              <button className="btn-ghost px-2" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))} aria-label="Next week">›</button>
            </div>
          </div>
          <p className="mb-3 hidden text-xs text-stone-400 sm:block">Drag a job to another day to move it.</p>

          <div className="space-y-3">
            {days.map((day) => {
              const dayJobs = jobsForDay(day);
              const dayBusy = externalForDay(day);
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dropOnDay(day)}
                  className={`card overflow-hidden ${dragId ? "ring-2 ring-dashed ring-brand-300" : ""}`}
                >
                  <div className={`flex items-center justify-between px-4 py-2.5 ${isToday ? "bg-brand-50" : "bg-stone-50"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isToday ? "text-brand-700" : "text-stone-700"}`}>
                        {day.toLocaleDateString("en-AU", { weekday: "long" })}
                      </span>
                      <span className="text-sm text-stone-400">{day.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span>
                    </div>
                    {isToday && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Today</span>}
                  </div>
                  {dayJobs.length === 0 && dayBusy.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-stone-300">No jobs</p>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {dayJobs.map((job) => (
                        <li
                          key={job.id}
                          draggable
                          onDragStart={() => setDragId(job.id)}
                          onDragEnd={() => setDragId(null)}
                          className="flex items-center gap-3 px-4 py-3 active:bg-stone-50"
                        >
                          <div className="w-14 shrink-0 text-xs font-semibold text-stone-500">{fmtRange(job.scheduledStart, job.scheduledEnd)}</div>
                          <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-stone-900">{job.title}</p>
                            <p className="truncate text-xs text-stone-500">{job.clientName || "—"}</p>
                          </Link>
                          <StatusPill status={job.status} />
                          <button onClick={() => setReschedule(job)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Reschedule">
                            <ClockIcon />
                          </button>
                        </li>
                      ))}
                      {dayBusy.map((e) => (
                        <li key={e.id} className="flex items-center gap-3 border-l-4 border-sky-300 px-4 py-2.5">
                          <div className="w-14 shrink-0 text-xs font-medium text-sky-700">{externalLabel(e)}</div>
                          <span className="min-w-0 flex-1 truncate text-sm text-sky-800">{e.title}</span>
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600">Busy</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {loading && <p className="py-6 text-center text-sm text-stone-400">Loading…</p>}

      <RescheduleModal job={reschedule} open={!!reschedule} onClose={() => setReschedule(null)} onDone={load} />
    </div>
  );
}

function DayList({
  jobs,
  busy = [],
  busyLabel,
  onReschedule,
  draggable,
  setDragId,
}: {
  jobs: JobDTO[];
  busy?: ExternalEvent[];
  busyLabel?: (e: ExternalEvent) => string;
  onReschedule: (j: JobDTO) => void;
  draggable?: boolean;
  setDragId?: (id: string | null) => void;
}) {
  if (jobs.length === 0 && busy.length === 0) {
    return <div className="card px-4 py-6 text-center text-sm text-stone-300">No jobs scheduled</div>;
  }
  return (
    <div className="card divide-y divide-stone-100">
      {jobs.map((job) => (
        <div
          key={job.id}
          draggable={draggable}
          onDragStart={() => setDragId?.(job.id)}
          onDragEnd={() => setDragId?.(null)}
          className="flex items-center gap-3 px-4 py-3 active:bg-stone-50"
        >
          <div className="w-14 shrink-0 text-xs font-semibold text-stone-500">{fmtRange(job.scheduledStart, job.scheduledEnd)}</div>
          <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900">{job.title}</p>
            <p className="truncate text-xs text-stone-500">{job.clientName || "—"}</p>
          </Link>
          <StatusPill status={job.status} />
          <button onClick={() => onReschedule(job)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Reschedule">
            <ClockIcon />
          </button>
        </div>
      ))}
      {busy.map((e) => (
        <div key={e.id} className="flex items-center gap-3 border-l-4 border-sky-300 px-4 py-2.5">
          <div className="w-14 shrink-0 text-xs font-medium text-sky-700">{busyLabel ? busyLabel(e) : ""}</div>
          <span className="min-w-0 flex-1 truncate text-sm text-sky-800">{e.title}</span>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600">Busy</span>
        </div>
      ))}
    </div>
  );
}

function dotColor(status: string): string {
  const map: Record<string, string> = {
    accepted: "bg-emerald-500",
    scheduled: "bg-brand-500",
    in_progress: "bg-amber-500",
    completed: "bg-green-600",
  };
  return map[status as JobStatus] || "bg-stone-400";
}

function ClockIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
