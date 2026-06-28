"use client";

import { useState } from "react";
import { api, type JobDTO, type ReportDTO } from "@/lib/job";

type RoomEntry = { name: string; work: string };

type ReportData = {
  engineer?: string;
  visitDate?: string;
  workCarried?: string;
  findings?: string;
  materialsUsed?: string;
  recommendations?: string;
  condition?: string;
  nextServiceDate?: string;
  rooms?: RoomEntry[];
};

type FlatKey = Exclude<keyof ReportData, "rooms">;

const FIELDS: { key: FlatKey; label: string; type: "text" | "textarea" | "date" | "select" }[] = [
  { key: "engineer", label: "Engineer / fitter", type: "text" },
  { key: "visitDate", label: "Visit date", type: "date" },
  { key: "workCarried", label: "Work carried out", type: "textarea" },
  { key: "findings", label: "Findings", type: "textarea" },
  { key: "materialsUsed", label: "Materials used", type: "textarea" },
  { key: "recommendations", label: "Recommendations", type: "textarea" },
  { key: "condition", label: "Overall condition", type: "select" },
  { key: "nextServiceDate", label: "Next service due", type: "date" },
];

export function ReportEditor({
  job,
  existing,
  onSaved,
}: {
  job: JobDTO;
  existing?: ReportDTO | null;
  onSaved: () => void;
}) {
  const [data, setData] = useState<ReportData>(() => {
    try {
      return existing?.data ? JSON.parse(existing.data) : {};
    } catch {
      return {};
    }
  });
  const [reportId, setReportId] = useState<string | undefined>(existing?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const set = (k: FlatKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData((p) => ({ ...p, [k]: e.target.value }));

  const rooms = data.rooms || [];
  const setRoom = (i: number, patch: Partial<RoomEntry>) =>
    setData((p) => ({
      ...p,
      rooms: (p.rooms || []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    }));
  const addRoom = () => setData((p) => ({ ...p, rooms: [...(p.rooms || []), { name: "", work: "" }] }));
  const removeRoom = (i: number) =>
    setData((p) => ({ ...p, rooms: (p.rooms || []).filter((_, idx) => idx !== i) }));

  async function autofill() {
    setBusy("autofill");
    setMsg(null);
    try {
      const res = await api<{ ok: boolean; data?: ReportData; message?: string }>(
        `/api/jobs/${job.id}/report/autofill`,
        { method: "POST" }
      );
      if (res.ok && res.data) {
        // Merge AI draft over empty fields, keeping anything already typed.
        setData((p) => ({
          ...res.data,
          ...Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== "")),
          rooms: (p.rooms && p.rooms.length ? p.rooms : res.data!.rooms) || [],
        }));
        setMsg("Draft filled in from the job details — review and edit before sending.");
      } else {
        setMsg(res.message || "Couldn't auto-fill right now.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function run(action: "save" | "generate" | "send") {
    setBusy(action);
    setMsg(null);
    try {
      const res = await api<{ report: ReportDTO; pdfBase64?: string; filename?: string }>(
        `/api/jobs/${job.id}/report`,
        { method: "POST", body: JSON.stringify({ reportId, data, action: action === "save" ? undefined : action }) }
      );
      setReportId(res.report.id);
      if (res.pdfBase64 && res.filename) {
        // Trigger a download of the freshly generated PDF.
        const blob = b64ToBlob(res.pdfBase64, "application/pdf");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      setMsg(
        action === "send"
          ? job.clientEmail
            ? "Report generated and emailed to the client."
            : "Report generated (no client email on file)."
          : action === "generate"
          ? "Report PDF generated and downloaded."
          : "Draft saved."
      );
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-100 disabled:opacity-50"
        disabled={!!busy}
        onClick={autofill}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {busy === "autofill" ? "Drafting from job…" : "Auto-fill with AI"}
      </button>

      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label">{f.label}</label>
          {f.type === "textarea" ? (
            <textarea className="input" rows={3} value={data[f.key] || ""} onChange={set(f.key)} />
          ) : f.type === "select" ? (
            <select className="input" value={data[f.key] || ""} onChange={set(f.key)}>
              <option value="">Select…</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Needs attention">Needs attention</option>
            </select>
          ) : (
            <input className="input" type={f.type} value={data[f.key] || ""} onChange={set(f.key)} />
          )}
        </div>
      ))}

      {/* Per-room breakdown */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label mb-0">Work by room</span>
          <button type="button" className="text-sm font-semibold text-brand-600" onClick={addRoom}>
            + Add room
          </button>
        </div>
        {rooms.length === 0 ? (
          <p className="text-xs text-stone-400">Optional — add rooms/areas to break the work down, or let AI fill them in.</p>
        ) : (
          <div className="space-y-2">
            {rooms.map((room, i) => (
              <div key={i} className="rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Room / area (e.g. Kitchen)"
                    value={room.name}
                    onChange={(e) => setRoom(i, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeRoom(i)}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200"
                    aria-label="Remove room"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Work carried out in this room"
                  value={room.work}
                  onChange={(e) => setRoom(i, { work: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {msg && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{msg}</p>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button className="btn-secondary" disabled={!!busy} onClick={() => run("save")}>
          {busy === "save" ? "Saving…" : "Save draft"}
        </button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => run("generate")}>
          {busy === "generate" ? "Generating…" : "Download PDF"}
        </button>
        <button className="btn-primary" disabled={!!busy} onClick={() => run("send")}>
          {busy === "send" ? "Sending…" : "Generate & email"}
        </button>
      </div>
    </div>
  );
}

function b64ToBlob(b64: string, type: string): Blob {
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}
