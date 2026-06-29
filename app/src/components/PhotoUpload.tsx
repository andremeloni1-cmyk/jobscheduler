"use client";

import { useRef, useState } from "react";
import type { JobDTO } from "@/lib/job";

/**
 * Site photos: upload images straight from the dashboard into the job's shared
 * "Photos (client)" Drive folder, and surface a link you can send to the client.
 */
export function PhotoUpload({ job, onChanged }: { job: JobDTO; onChanged: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const photos = (job.documents || []).filter((d) => d.source === "upload");
  const clientLink = job.drivePhotosFolderId
    ? `https://drive.google.com/drive/folders/${job.drivePhotosFolderId}`
    : "";

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));
      const res = await fetch(`/api/jobs/${job.id}/photos`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setMsg(data.message || "Couldn't upload photos just now.");
      } else {
        setMsg(`Uploaded ${data.saved} photo${data.saved === 1 ? "" : "s"} — saved to the client folder.`);
        onChanged();
      }
    } catch {
      setMsg("Couldn't upload photos just now.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function copyLink() {
    if (!clientLink) return;
    try {
      await navigator.clipboard.writeText(clientLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still shown below */
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-100 disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <circle cx="12" cy="13" r="3.5" />
          <path d="M8 6l1.5-2h5L16 6" strokeLinejoin="round" />
        </svg>
        {busy ? "Uploading…" : "Upload / take photos"}
      </button>

      {photos.length > 0 ? (
        <ul className="space-y-2">
          {photos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700">
                <span>🖼</span>
                <span className="truncate">{p.name}</span>
              </span>
              {p.webViewLink && (
                <a href={p.webViewLink} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-brand-600">
                  Open
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400">
          No photos yet. Upload site photos and a shareable link is created for the client automatically.
        </p>
      )}

      {clientLink && (
        <div className="rounded-xl bg-stone-50 p-3 ring-1 ring-inset ring-stone-200">
          <p className="label mb-1">Client photo link (anyone with the link can view)</p>
          <div className="flex items-center gap-2">
            <a
              href={clientLink}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-brand-600"
            >
              {clientLink}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-lg bg-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-300"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {msg && <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">{msg}</p>}
    </div>
  );
}
