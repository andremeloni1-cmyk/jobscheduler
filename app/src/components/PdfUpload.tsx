"use client";

import { useRef, useState } from "react";
import type { JobDTO } from "@/lib/job";
import { PaperclipIcon } from "@/components/icons";

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** Upload one or more PDFs to a job's Drive folder from the job page. Posts to
 * the same endpoint used at job creation, then refreshes the documents list. */
export function PdfUpload({ job, onChanged }: { job: JobDTO; onChanged: () => void | Promise<void> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter(isPdf);
    e.target.value = ""; // allow re-picking the same file later
    if (files.length === 0) {
      setMsg("Please choose a PDF.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch(`/api/jobs/${job.id}/pdfs`, { method: "POST", body: form })
        .then((r) => r.json())
        .catch(() => null);
      if (!res) setMsg("Upload failed — please try again.");
      else if (res.connected === false) setMsg("Connect Google in Settings to upload PDFs to Drive.");
      else if (res.saved > 0) await onChanged();
      else setMsg(res.message || "No PDF was added.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-night-line dark:bg-night-850 dark:text-slate-300 dark:hover:bg-night-800"
      >
        <PaperclipIcon className="h-4 w-4" /> {busy ? "Uploading…" : "Upload PDF"}
      </button>
      <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={onPick} />
      {msg && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{msg}</p>}
    </div>
  );
}
