"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { fmtMoney, fmtDay } from "@/lib/format";
import { api } from "@/lib/job";
import { companyPalette } from "@/lib/colors";
import { UserIcon, PinIcon } from "@/components/icons";

type ClientJob = {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  quoteAmount?: number | null;
  currency: string;
  siteContact?: string | null;
  address?: string | null;
};
type Company = {
  key: string;
  name: string;
  email?: string | null;
  jobCount: number;
  activeCount: number;
  totalValue: number;
  currency: string;
  lastActivityAt: string;
  jobs: ClientJob[];
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Company | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { clients } = await api<{ clients: Company[] }>("/api/clients");
        setClients(clients);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.jobs.some((j) => (j.siteContact || "").toLowerCase().includes(q))
    );
  }, [clients, query]);

  return (
    <div className="px-4 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Clients</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">The joinery companies you work for</p>
      </header>

      <div className="relative mb-3">
        <input
          className="input pl-10"
          placeholder="Search company or site contact…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <svg className="absolute left-3 top-3 h-5 w-5 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 skeleton rounded-bento" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserIcon className="h-7 w-7" />}
          title={clients.length === 0 ? "No companies yet" : "No matches"}
          subtitle={clients.length === 0 ? "Add a company under Settings → Incoming jobs." : "No companies match your search."}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelected(c)}
              className={`card tap flex w-full items-center gap-3 border-l-4 p-3.5 text-left ${companyPalette({ companyId: c.key, companyName: c.name }).bar}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500 dark:bg-night-800 dark:text-slate-400">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {c.jobCount === 0 ? "No jobs yet" : `${c.jobCount} job${c.jobCount === 1 ? "" : "s"}`}
                  {c.activeCount > 0 && <span className="text-emerald-600 dark:text-emerald-300"> · {c.activeCount} active</span>}
                </p>
              </div>
              {c.totalValue > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{fmtMoney(c.totalValue, c.currency)}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Company"}>
        {selected && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Jobs" value={String(selected.jobCount)} />
              <Stat label="Active" value={String(selected.activeCount)} />
              <Stat label="Value" value={fmtMoney(selected.totalValue, selected.currency)} />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Jobs</p>
              {selected.jobs.length === 0 ? (
                <p className="card text-sm text-slate-400 dark:text-slate-500">No jobs for this company yet.</p>
              ) : (
                <div className="card divide-y divide-slate-100 dark:divide-night-line2">
                  {selected.jobs.map((j) => (
                    <Link
                      key={j.id}
                      href={`/jobs/${j.id}`}
                      className="flex items-center gap-3 px-3.5 py-2.5 active:bg-slate-50 dark:active:bg-night-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{j.title}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {j.siteContact && (
                            <span className="inline-flex items-center gap-1">
                              <PinIcon className="h-3 w-3" />
                              {j.siteContact}
                              {" · "}
                            </span>
                          )}
                          {j.reference} · {fmtDay(j.scheduledStart)}
                        </p>
                      </div>
                      {j.quoteAmount != null && (
                        <span className="shrink-0 text-xs font-medium text-slate-600 dark:text-slate-300">{fmtMoney(j.quoteAmount, j.currency)}</span>
                      )}
                      <StatusPill status={j.status} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-night-850">
      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().replace(/\(.*\)/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
