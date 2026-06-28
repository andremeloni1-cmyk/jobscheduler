"use client";

import { useState } from "react";
import Link from "next/link";
import { api, type JobDTO } from "@/lib/job";
import { relativeTime, fmtDay, fmtRange } from "@/lib/format";

/**
 * "Incoming jobs to approve" — leads imported from trusted senders' emails.
 * Approve accepts the job (and emails the sender); Dismiss removes it.
 */
export function LeadInbox({
  leads,
  onChanged,
  onScan,
  scanning,
}: {
  leads: JobDTO[];
  onChanged: () => void;
  onScan: () => void;
  scanning: boolean;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function approve(job: JobDTO) {
    setBusyId(job.id);
    try {
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ status: "accepted" }) });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(job: JobDTO) {
    if (!confirm(`Dismiss "${job.title}"? It will be removed from your leads.`)) return;
    setBusyId(job.id);
    try {
      await api(`/api/jobs/${job.id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-stone-700">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
            {leads.length}
          </span>
          Incoming jobs to approve
        </h2>
        <button onClick={onScan} disabled={scanning} className="text-sm font-semibold text-brand-600 disabled:opacity-50">
          {scanning ? "Checking…" : "Check inbox"}
        </button>
      </div>

      <div className="space-y-2">
        {leads.map((job) => (
          <div key={job.id} className="card border-l-4 border-brand-400 p-3.5">
            <Link href={`/jobs/${job.id}`} className="block">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">
                  New
                </span>
                <h3 className="truncate font-semibold text-stone-900">{job.title}</h3>
              </div>
              <p className="mt-0.5 truncate text-sm text-stone-500">
                From {job.clientName || job.leadSource}
                {job.documents && job.documents.length > 0 ? ` · 📎 ${job.documents.length}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {job.scheduledStart ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    🗓 {fmtDay(job.scheduledStart)} · {fmtRange(job.scheduledStart, job.scheduledEnd)}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500">No date — set after approving</span>
                )}
                {job.address && (
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                    📍 {job.address}
                  </span>
                )}
              </div>
              {job.description && <p className="mt-1.5 line-clamp-2 text-xs text-stone-400">{job.description}</p>}
            </Link>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1 py-2" disabled={busyId === job.id} onClick={() => approve(job)}>
                {busyId === job.id ? "…" : "Approve"}
              </button>
              <button className="btn-secondary px-4 py-2" disabled={busyId === job.id} onClick={() => dismiss(job)}>
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
