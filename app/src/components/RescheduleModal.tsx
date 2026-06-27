"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { toLocalInput } from "@/lib/format";
import { api, type JobDTO } from "@/lib/job";

export function RescheduleModal({
  job,
  open,
  onClose,
  onDone,
}: {
  job: JobDTO | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("120");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialise fields when a job is selected.
  if (job && open && start === "" && job.scheduledStart) {
    setStart(toLocalInput(job.scheduledStart));
    setDuration(String(job.durationMins || 120));
  }

  async function save() {
    if (!job) return;
    setSaving(true);
    try {
      const s = start ? new Date(start) : null;
      const dur = parseInt(duration, 10) || 120;
      const e = s ? new Date(s.getTime() + dur * 60_000) : null;
      await api(`/api/jobs/${job.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          scheduledStart: s ? s.toISOString() : null,
          scheduledEnd: e ? e.toISOString() : null,
          durationMins: dur,
          status: job.status === "lead" || job.status === "quoted" ? "scheduled" : job.status,
          notify,
        }),
      });
      setStart("");
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={job ? `Reschedule — ${job.title}` : "Reschedule"}>
      <div className="space-y-4">
        <div>
          <label className="label">New start</label>
          <input className="input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="label">Duration (mins)</label>
          <input className="input" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <label className="flex items-center gap-3 text-sm text-stone-700">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-5 w-5 rounded accent-brand-600" />
          Email the client about the new time
        </label>
        <div className="flex gap-3 pt-1">
          <button className="btn-secondary flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? "Moving…" : "Move job"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
