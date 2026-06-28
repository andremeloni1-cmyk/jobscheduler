"use client";

import { useEffect, useMemo, useState } from "react";
import { JobCard } from "@/components/JobCard";
import { Modal } from "@/components/Modal";
import { JobForm } from "@/components/JobForm";
import { LeadInbox } from "@/components/LeadInbox";
import { JOB_STATUSES, STATUS_LABELS } from "@/lib/types";
import { api, type JobDTO } from "@/lib/job";

const FILTERS = ["active", ...JOB_STATUSES] as const;

export default function DashboardPage() {
  const [jobs, setJobs] = useState<JobDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("active");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { jobs } = await api<{ jobs: JobDTO[] }>("/api/jobs");
      setJobs(jobs);
    } catch {
      /* unauthenticated handled by middleware redirect */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = jobs;
    if (filter === "active") {
      list = list.filter((j) => !["completed", "cancelled"].includes(j.status));
    } else {
      list = list.filter((j) => j.status === filter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          (j.clientName || "").toLowerCase().includes(q) ||
          j.reference.toLowerCase().includes(q) ||
          (j.address || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jobs, filter, query]);

  const counts = useMemo(() => {
    const active = jobs.filter((j) => !["completed", "cancelled"].includes(j.status)).length;
    const scheduled = jobs.filter((j) => j.scheduledStart && j.status !== "cancelled").length;
    const value = jobs
      .filter((j) => !["cancelled"].includes(j.status))
      .reduce((sum, j) => sum + (j.quoteAmount || 0), 0);
    return { active, scheduled, value };
  }, [jobs]);

  // Imported email leads awaiting approval.
  const leads = useMemo(
    () => jobs.filter((j) => j.leadSource && j.status === "lead"),
    [jobs]
  );

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  }

  async function scanInbox() {
    setScanning(true);
    try {
      // force=1: re-check emails even if a previous scan already saw them (so a
      // dismissed lead can be re-imported, and fixes apply to old emails).
      const res = await api<{ created: number; connected: boolean }>("/api/leads/scan?force=1", { method: "POST" });
      if (!res.connected) flash("Connect Google in Settings to check your inbox.");
      else flash(res.created > 0 ? `Found ${res.created} new job${res.created > 1 ? "s" : ""} to approve` : "No new jobs in your inbox");
      await load();
    } catch {
      flash("Couldn't check the inbox just now.");
    } finally {
      setScanning(false);
    }
  }

  async function createJob(payload: Record<string, unknown>) {
    await api("/api/jobs", { method: "POST", body: JSON.stringify(payload) });
    setShowNew(false);
    await load();
  }

  return (
    <div className="px-4 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">JoineryFlow</h1>
          <p className="text-sm text-stone-500">Your jobs at a glance</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
          <SawIcon />
        </div>
      </header>

      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 mx-auto max-w-lg rounded-xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Incoming jobs to approve */}
      {leads.length > 0 && (
        <LeadInbox leads={leads} onChanged={load} onScan={scanInbox} scanning={scanning} />
      )}

      {/* Summary */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="Active" value={String(counts.active)} />
        <Stat label="Scheduled" value={String(counts.scheduled)} />
        <Stat
          label="Pipeline"
          value={new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(counts.value)}
        />
      </div>

      {leads.length === 0 && (
        <button
          onClick={scanInbox}
          disabled={scanning}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 ring-1 ring-stone-200 transition active:scale-[0.99] disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          {scanning ? "Checking inbox…" : "Check inbox for new jobs"}
        </button>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <input
          className="input pl-10"
          placeholder="Search jobs, clients, addresses…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <svg className="absolute left-3 top-3 h-5 w-5 text-stone-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
      </div>

      {/* Filter chips */}
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              filter === f ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
            }`}
          >
            {f === "active" ? "Active" : STATUS_LABELS[f as keyof typeof STATUS_LABELS]}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-stone-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setShowNew(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setShowNew(true)}
        className="fixed bottom-24 right-1/2 z-30 flex translate-x-[15rem] items-center gap-2 rounded-full bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 transition active:scale-95 max-[33rem]:right-5 max-[33rem]:translate-x-0"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
        New job
      </button>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New job">
        <JobForm onSubmit={createJob} onCancel={() => setShowNew(false)} submitLabel="Create job" />
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-3 py-3 text-center">
      <div className="text-lg font-bold text-stone-900">{value}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <SawIcon />
      </div>
      <div>
        <p className="font-semibold text-stone-800">No jobs here yet</p>
        <p className="text-sm text-stone-500">Add your first joinery job to get started.</p>
      </div>
      <button className="btn-primary" onClick={onAdd}>
        Add a job
      </button>
    </div>
  );
}

function SawIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l11 11M14 18l6-6-3-3-6 6M3 7l4-4 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
