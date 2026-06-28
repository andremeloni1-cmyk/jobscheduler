"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { toLocalInput } from "@/lib/format";
import { api, type JobDTO } from "@/lib/job";
import { WORKDAY_MINS, jobEnd } from "@/lib/schedule";

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
  const [duration, setDuration] = useState(String(WORKDAY_MINS));
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialise fields when a job is selected.
  if (job && open && start === "" && job.scheduledStart) {
    setStart(toLocalInput(job.scheduledStart));
    setDuration(String(job.durationMins || WORKDAY_MINS));
  }

  async function save() {
    if (!job) return;
    setSaving(true);
    try {
      const s = start ? new Date(start) : null;
      const dur = parseInt(duration, 10) || WORKDAY_MINS;
      const e = s ? jobEnd(s, dur) : null;
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
          <label className="label">Duration</label>
          <div className="mb-2 flex gap-2">
            {[1, 2, 3, 4].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(String(d * WORKDAY_MINS))}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                  parseInt(duration, 10) === d * WORKDAY_MINS ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600"
                }`}
              >
                {d} day{d > 1 ? "s" : ""}
              </button>
            ))}
          </div>
          <input className="input" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          <p className="mt-1 text-xs text-stone-400">Minutes. One work day = {WORKDAY_MINS} (6:30am–3:00pm). Multi-day jobs spill onto the next working days.</p>
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
