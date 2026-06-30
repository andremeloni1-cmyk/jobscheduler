"use client";

import { useState } from "react";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/types";
import { toLocalInput, fromLocalInput } from "@/lib/format";
import type { JobDTO } from "@/lib/job";
import { PaperclipIcon, DocumentIcon } from "@/components/icons";

export type JobFormValues = {
  title: string;
  description: string;
  status: string;
  priority: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  address: string;
  quoteAmount: string;
  durationMins: string;
  scheduledStart: string;
  notes: string;
};

function initial(job?: Partial<JobDTO>): JobFormValues {
  return {
    title: job?.title || "",
    description: job?.description || "",
    status: job?.status || "lead",
    priority: job?.priority || "normal",
    clientName: job?.clientName || "",
    clientEmail: job?.clientEmail || "",
    clientPhone: job?.clientPhone || "",
    address: job?.address || "",
    quoteAmount: job?.quoteAmount != null ? String(job.quoteAmount) : "",
    durationMins: job?.durationMins ? String(job.durationMins) : "120",
    scheduledStart: toLocalInput(job?.scheduledStart),
    notes: job?.notes || "",
  };
}

export function JobForm({
  job,
  onSubmit,
  onCancel,
  submitLabel = "Save job",
}: {
  job?: Partial<JobDTO>;
  onSubmit: (payload: Record<string, unknown>, pdf?: File | null) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<JobFormValues>(initial(job));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Optional plans PDF, only offered when creating a new job (no `job` prop).
  const [pdf, setPdf] = useState<File | null>(null);

  const set = (k: keyof JobFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.title.trim()) return setError("Please enter a job title.");
    setSaving(true);
    setError(null);
    try {
      const start = v.scheduledStart ? fromLocalInput(v.scheduledStart) : null;
      const dur = parseInt(v.durationMins, 10) || 120;
      const end = start ? new Date(start.getTime() + dur * 60_000) : null;
      await onSubmit({
        title: v.title.trim(),
        description: v.description || null,
        status: v.status,
        priority: v.priority,
        clientName: v.clientName || null,
        clientEmail: v.clientEmail || null,
        clientPhone: v.clientPhone || null,
        address: v.address || null,
        quoteAmount: v.quoteAmount ? Number(v.quoteAmount) : null,
        durationMins: dur,
        scheduledStart: start ? start.toISOString() : null,
        scheduledEnd: end ? end.toISOString() : null,
        notes: v.notes || null,
      }, pdf);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Job title</label>
        <input className="input" value={v.title} onChange={set("title")} placeholder="e.g. Oak staircase installation" autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Status</label>
          <select className="input" value={v.status} onChange={set("status")}>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="input" value={v.priority} onChange={set("priority")}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={2} value={v.description} onChange={set("description")} placeholder="What's the work?" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Client name</label>
          <input className="input" value={v.clientName} onChange={set("clientName")} />
        </div>
        <div>
          <label className="label">Client phone</label>
          <input className="input" value={v.clientPhone} onChange={set("clientPhone")} />
        </div>
      </div>

      <div>
        <label className="label">Client email</label>
        <input className="input" type="email" value={v.clientEmail} onChange={set("clientEmail")} placeholder="for automated updates" />
      </div>

      <div>
        <label className="label">Site address</label>
        <input className="input" value={v.address} onChange={set("address")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Value (A$)</label>
          <input className="input" type="number" inputMode="decimal" value={v.quoteAmount} onChange={set("quoteAmount")} />
        </div>
        <div>
          <label className="label">Duration (mins)</label>
          <input className="input" type="number" inputMode="numeric" value={v.durationMins} onChange={set("durationMins")} />
        </div>
      </div>

      <div>
        <label className="label">Scheduled start</label>
        <input className="input" type="datetime-local" value={v.scheduledStart} onChange={set("scheduledStart")} />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          Setting a start while status is Accepted/Scheduled adds it to your Google Calendar.
        </p>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={v.notes} onChange={set("notes")} />
      </div>

      {/* Attach a plans PDF when creating a job — uploaded to the job's Drive folder after it's saved. */}
      {!job && (
        <div>
          <label className="label">Plans (PDF)</label>
          {pdf ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3.5 py-2.5 ring-1 ring-inset ring-slate-200 dark:bg-night-850 dark:ring-night-line">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <DocumentIcon className="h-4 w-4 shrink-0" />
                <span className="truncate">{pdf.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setPdf(null)}
                aria-label="Remove PDF"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-200/70 dark:text-slate-500 dark:hover:bg-night-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-night-line dark:bg-night-850 dark:text-slate-300 dark:hover:bg-night-800">
              <PaperclipIcon className="h-4 w-4" /> Attach a PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPdf(e.target.files?.[0] || null)}
              />
            </label>
          )}
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Optional — uploaded to the job&apos;s Google Drive folder after it&apos;s created.</p>
        </div>
      )}

      {error && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
