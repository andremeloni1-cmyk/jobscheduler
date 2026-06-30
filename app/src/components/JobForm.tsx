"use client";

import { useState } from "react";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/types";
import { toLocalInput, fromLocalInput } from "@/lib/format";
import type { JobDTO } from "@/lib/job";

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
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}) {
  const [v, setV] = useState<JobFormValues>(initial(job));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
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
