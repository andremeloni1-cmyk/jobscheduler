"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { Modal } from "@/components/Modal";
import { JobForm } from "@/components/JobForm";
import { ReportEditor } from "@/components/ReportEditor";
import { RescheduleModal } from "@/components/RescheduleModal";
import { fmtMoney, fmtDay, fmtRange, relativeTime } from "@/lib/format";
import { api, type JobDTO } from "@/lib/job";

const NEXT_ACTIONS: Record<string, { status: string; label: string; style: string }[]> = {
  lead: [{ status: "quoted", label: "Mark quoted", style: "btn-secondary" }],
  quoted: [{ status: "accepted", label: "Accept job", style: "btn-primary" }],
  accepted: [{ status: "in_progress", label: "Start work", style: "btn-primary" }],
  scheduled: [{ status: "in_progress", label: "Start work", style: "btn-primary" }],
  in_progress: [{ status: "completed", label: "Mark complete", style: "btn-primary" }],
  completed: [],
  cancelled: [{ status: "accepted", label: "Reopen", style: "btn-secondary" }],
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}`);
      setJob(job);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [id]);

  // Open the report editor directly when linked from the Reports section.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("report") === "1") {
      setShowReport(true);
    }
  }, []);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  }

  async function changeStatus(status: string) {
    if (!job) return;
    setBusy(true);
    try {
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      if (status === "accepted") flash("Accepted — calendar updated & client emailed (if Google connected)");
      else if (status === "cancelled") flash("Cancelled — calendar cleared & client emailed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(payload: Record<string, unknown>) {
    if (!job) return;
    await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify(payload) });
    setEditing(false);
    await load();
  }

  async function remove() {
    if (!job) return;
    if (!confirm(`Delete "${job.title}"? This also removes its calendar event.`)) return;
    await api(`/api/jobs/${job.id}`, { method: "DELETE" });
    router.push("/");
  }

  async function syncPdfs() {
    if (!job) return;
    setBusy(true);
    try {
      const res = await api<{ saved: number; connected: boolean; message?: string }>(
        `/api/jobs/${job.id}/sync-pdfs`,
        { method: "POST" }
      );
      if (!res.connected) flash(res.message || "Connect Google in Settings to search email.");
      else flash(res.saved > 0 ? `Saved ${res.saved} PDF(s) to Drive` : "No new PDFs found in email");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="px-4 pt-6 text-stone-400">Loading…</div>;
  if (!job) return <div className="px-4 pt-6 text-stone-500">Job not found. <Link href="/" className="text-brand-600">Back</Link></div>;

  const actions = NEXT_ACTIONS[job.status] || [];
  const latestReport = job.reports?.[0] || null;

  return (
    <div className="px-4 pt-5">
      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-lg rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        All jobs
      </Link>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-stone-900">{job.title}</h1>
          <StatusPill status={job.status} />
        </div>
        <p className="mt-1 text-sm text-stone-500">{job.reference}</p>
      </div>

      {/* Primary actions */}
      <div className="mb-4 flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.status} className={a.style} disabled={busy} onClick={() => changeStatus(a.status)}>
            {a.label}
          </button>
        ))}
        <button className="btn-secondary" onClick={() => setRescheduling(true)}>
          {job.scheduledStart ? "Reschedule" : "Schedule"}
        </button>
        {job.status !== "cancelled" && job.status !== "completed" && (
          <button className="btn-ghost text-red-600" disabled={busy} onClick={() => changeStatus("cancelled")}>
            Cancel job
          </button>
        )}
      </div>

      {/* Schedule + money card */}
      <div className="card mb-3 divide-y divide-stone-100">
        <Row icon="cal" label="Scheduled">
          {job.scheduledStart ? (
            <span>
              {fmtDay(job.scheduledStart)} · {fmtRange(job.scheduledStart, job.scheduledEnd)}
            </span>
          ) : (
            <span className="text-stone-400">Not scheduled</span>
          )}
        </Row>
        <Row icon="money" label="Quote">{fmtMoney(job.quoteAmount, job.currency)}</Row>
        {job.googleEventId && (
          <Row icon="cal" label="Calendar">
            <span className="text-emerald-600">On Google Calendar ✓</span>
          </Row>
        )}
      </div>

      {/* Client card */}
      <div className="card mb-3 divide-y divide-stone-100">
        <Row icon="user" label="Client">{job.clientName || "—"}</Row>
        {job.clientPhone && (
          <Row icon="phone" label="Phone">
            <a href={`tel:${job.clientPhone}`} className="text-brand-600">{job.clientPhone}</a>
          </Row>
        )}
        {job.clientEmail && (
          <Row icon="mail" label="Email">
            <a href={`mailto:${job.clientEmail}`} className="text-brand-600">{job.clientEmail}</a>
          </Row>
        )}
        {job.address && (
          <Row icon="pin" label="Address">
            <a href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" className="text-brand-600">
              {job.address}
            </a>
          </Row>
        )}
      </div>

      {job.description && (
        <div className="card mb-3 p-4">
          <p className="label mb-1">Description</p>
          <p className="whitespace-pre-wrap text-sm text-stone-700">{job.description}</p>
        </div>
      )}

      {/* Documents */}
      <Section title="Documents" action={<button className="text-sm font-semibold text-brand-600" onClick={syncPdfs} disabled={busy}>Find in email</button>}>
        {job.documents && job.documents.length > 0 ? (
          <ul className="space-y-2">
            {job.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-sm text-stone-700">
                  <span>📄</span>
                  <span className="truncate">{d.name}</span>
                </span>
                {d.webViewLink ? (
                  <a href={d.webViewLink} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-semibold text-brand-600">
                    Open
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-stone-400">{d.source}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400">
            No documents yet. Tap “Find in email” to pull job PDFs from Gmail into Google Drive.
          </p>
        )}
      </Section>

      {/* Maintenance report */}
      <Section
        title="Maintenance report"
        action={
          <button className="text-sm font-semibold text-brand-600" onClick={() => setShowReport((s) => !s)}>
            {showReport ? "Hide" : latestReport ? "Edit" : "Create"}
          </button>
        }
      >
        {latestReport && !showReport && (
          <p className="text-sm text-stone-600">
            {latestReport.status === "sent" ? `Sent ${relativeTime(latestReport.sentAt)}` : "Draft saved"}
            {latestReport.webViewLink && (
              <>
                {" · "}
                <a href={latestReport.webViewLink} target="_blank" rel="noreferrer" className="text-brand-600">
                  View on Drive
                </a>
              </>
            )}
          </p>
        )}
        {!latestReport && !showReport && (
          <p className="text-sm text-stone-400">Fill out a maintenance report and email it to the client as a PDF.</p>
        )}
        {showReport && <ReportEditor job={job} existing={latestReport} onSaved={load} />}
      </Section>

      {/* Activity */}
      {job.activities && job.activities.length > 0 && (
        <Section title="Activity">
          <ul className="space-y-3">
            {job.activities.map((a) => (
              <li key={a.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                <div>
                  <p className="text-stone-700">{a.message}</p>
                  <p className="text-xs text-stone-400">{relativeTime(a.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Footer actions */}
      <div className="mt-5 flex gap-3">
        <button className="btn-secondary flex-1" onClick={() => setEditing(true)}>
          Edit job
        </button>
        <button className="btn-danger" onClick={remove}>
          Delete
        </button>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit job">
        <JobForm job={job} onSubmit={saveEdit} onCancel={() => setEditing(false)} />
      </Modal>

      <RescheduleModal job={job} open={rescheduling} onClose={() => setRescheduling(false)} onDone={load} />
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card mb-3 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-stone-900">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-stone-400"><RowIcon name={icon} /></span>
      <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-stone-800">{children}</span>
    </div>
  );
}

function RowIcon({ name }: { name: string }) {
  const cls = "h-4 w-4";
  switch (name) {
    case "cal":
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" /></svg>;
    case "money":
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" /></svg>;
    case "user":
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" /></svg>;
    case "phone":
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" strokeLinejoin="round" /></svg>;
    case "mail":
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
    case "pin":
      return <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>;
    default:
      return null;
  }
}
