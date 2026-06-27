"use client";

import { useState } from "react";
import { api, type JobDTO, type ReportDTO } from "@/lib/job";

type ReportData = {
  engineer?: string;
  visitDate?: string;
  workCarried?: string;
  findings?: string;
  materialsUsed?: string;
  recommendations?: string;
  condition?: string;
  nextServiceDate?: string;
};

const FIELDS: { key: keyof ReportData; label: string; type: "text" | "textarea" | "date" | "select" }[] = [
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

  const set = (k: keyof ReportData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setData((p) => ({ ...p, [k]: e.target.value }));

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
