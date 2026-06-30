"use client";

import { useEffect, useState } from "react";
import { api, type JobDTO } from "@/lib/job";
import { relativeTime } from "@/lib/format";

/** Recently deleted jobs — restore within 30 days, or remove permanently. */
export function RecentlyDeleted() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    try {
      const { jobs } = await api<{ jobs: JobDTO[] }>("/api/jobs?deleted=1");
      setJobs(jobs);
    } catch {
      /* ignore */
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function restore(job: JobDTO) {
    setBusyId(job.id);
    try {
      await api(`/api/jobs/${job.id}/restore`, { method: "POST" });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } finally {
      setBusyId(null);
    }
  }

  async function purge(job: JobDTO) {
    if (confirmId !== job.id) {
      setConfirmId(job.id);
      return;
    }
    setBusyId(job.id);
    try {
      await api(`/api/jobs/${job.id}?hard=1`, { method: "DELETE" });
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  }

  // Hide the card entirely when there's nothing binned.
  if (!loaded || jobs.length === 0) return null;

  return (
    <div className="card mb-4 p-4">
      <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Recently deleted</h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Deleted jobs are kept for 30 days. Restore one, or remove it for good.
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-night-line2">
        {jobs.map((job) => (
          <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{job.title}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Deleted {relativeTime(job.deletedAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => restore(job)}
                disabled={busyId === job.id}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Restore
              </button>
              <button
                onClick={() => purge(job)}
                disabled={busyId === job.id}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/15 disabled:opacity-50"
              >
                {confirmId === job.id ? "Confirm" : "Delete forever"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
