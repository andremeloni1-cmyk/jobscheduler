"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { RescheduleModal } from "@/components/RescheduleModal";
import { fmtRange } from "@/lib/format";
import { api, type JobDTO } from "@/lib/job";

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
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

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000)),
    [weekStart]
  );

  function jobsForDay(day: Date) {
    return jobs
      .filter((j) => j.scheduledStart && sameDay(new Date(j.scheduledStart), day))
      .sort((a, b) => new Date(a.scheduledStart!).getTime() - new Date(b.scheduledStart!).getTime());
  }

  // Drag a job onto another day: keep the time of day, change the date.
  async function dropOnDay(day: Date) {
    if (!dragId) return;
    const job = jobs.find((j) => j.id === dragId);
    setDragId(null);
    if (!job || !job.scheduledStart) return;
    const old = new Date(job.scheduledStart);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    if (sameDay(old, next)) return;

    const end = new Date(next.getTime() + (job.durationMins || 120) * 60_000);
    // optimistic
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, scheduledStart: next.toISOString(), scheduledEnd: end.toISOString() } : j))
    );
    try {
      await api(`/api/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          scheduledStart: next.toISOString(),
          scheduledEnd: end.toISOString(),
          notify: true,
        }),
      });
      setHint(`Moved "${job.title}" — client notified`);
      setTimeout(() => setHint(null), 2500);
    } catch {
      load(); // revert
    }
  }

  const today = new Date();

  return (
    <div className="px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">Calendar</h1>
        <div className="flex items-center gap-1">
          <button className="btn-ghost px-2" onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))} aria-label="Previous week">
            ‹
          </button>
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </button>
          <button className="btn-ghost px-2" onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))} aria-label="Next week">
            ›
          </button>
        </div>
      </header>

      <p className="mb-4 text-sm text-stone-500">
        {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
        {days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        <span className="ml-2 hidden text-xs text-stone-400 sm:inline">· drag a job to another day to move it</span>
      </p>

      {hint && (
        <div className="mb-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{hint}</div>
      )}

      <div className="space-y-3">
        {days.map((day) => {
          const dayJobs = jobsForDay(day);
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
                    {day.toLocaleDateString("en-GB", { weekday: "long" })}
                  </span>
                  <span className="text-sm text-stone-400">{day.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                </div>
                {isToday && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">Today</span>}
              </div>

              {dayJobs.length === 0 ? (
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
                      <div className="w-14 shrink-0 text-xs font-semibold text-stone-500">
                        {fmtRange(job.scheduledStart, job.scheduledEnd)}
                      </div>
                      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-stone-900">{job.title}</p>
                        <p className="truncate text-xs text-stone-500">{job.clientName || "—"}</p>
                      </Link>
                      <StatusPill status={job.status} />
                      <button
                        onClick={() => setReschedule(job)}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"
                        aria-label="Reschedule"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 8v4l3 2" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="12" cy="12" r="9" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {loading && <p className="py-6 text-center text-sm text-stone-400">Loading…</p>}

      <RescheduleModal job={reschedule} open={!!reschedule} onClose={() => setReschedule(null)} onDone={load} />
    </div>
  );
}
