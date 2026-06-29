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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const photos = (job.documents || []).filter((d) => d.source === "upload");
  const clientLink = job.drivePhotosFolderId
    ? `https://drive.google.com/drive/folders/${job.drivePhotosFolderId}`
    : "";

  // Upload in small sequential chunks rather than one big request. This keeps
  // each request well under the server/nginx size limit (so a 30-photo job from
  // a 24 MP phone goes through reliably), keeps server memory low, and lets us
  // show progress. The chunks run one after another so the shared Drive photos
  // folder is created exactly once (no race on the first batch).
  const CHUNK_SIZE = 4;

  async function upload(fileList: FileList | null) {
    const images = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      if (fileList && fileList.length) setMsg("Those files aren’t images — pick photos to upload.");
      return;
    }

    setBusy(true);
    setMsg(null);
    setProgress({ done: 0, total: images.length });

    let saved = 0;
    let failed = 0;
    let note: string | null = null; // a specific server message worth surfacing (e.g. "connect Google")
    let shareBlocked = false; // Google account refused anyone-with-link sharing
    try {
      for (let i = 0; i < images.length; i += CHUNK_SIZE) {
        const group = images.slice(i, i + CHUNK_SIZE);
        const form = new FormData();
        group.forEach((f) => form.append("files", f));
        try {
          const res = await fetch(`/api/jobs/${job.id}/photos`, { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok !== false) {
            saved += data.saved || 0;
            if (data.shared === false) shareBlocked = true;
          } else {
            failed += group.length;
            if (data.message) note = data.message;
          }
        } catch {
          failed += group.length;
        }
        setProgress({ done: Math.min(i + CHUNK_SIZE, images.length), total: images.length });
      }

      if (saved > 0) onChanged();
      const warn = shareBlocked
        ? " ⚠️ Your Google account blocked the public link, so clients can’t open it yet — see the note below."
        : "";
      setMsg(
        note && saved === 0
          ? note
          : failed > 0
          ? `Uploaded ${saved} photo${saved === 1 ? "" : "s"}; ${failed} didn’t go through — try those again.${warn}`
          : `Uploaded ${saved} photo${saved === 1 ? "" : "s"} — saved to the client folder.${warn}`
      );
    } finally {
      setBusy(false);
      setProgress(null);
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
        {busy ? (progress ? `Uploading ${progress.done}/${progress.total}…` : "Uploading…") : "Upload / take photos"}
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
