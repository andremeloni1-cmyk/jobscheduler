"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { fmtMoney, fmtDay } from "@/lib/format";
import { api } from "@/lib/job";
import { companyPalette } from "@/lib/colors";

type ClientJob = {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  quoteAmount?: number | null;
  currency: string;
};
type Client = {
  key: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  leadSource?: string | null;
  jobCount: number;
  activeCount: number;
  totalValue: number;
  currency: string;
  lastActivityAt: string;
  jobs: ClientJob[];
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { clients } = await api<{ clients: Client[] }>("/api/clients");
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
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [clients, query]);

  return (
    <div className="px-4 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-slate-100">Clients</h1>
        <p className="text-sm text-stone-500 dark:text-slate-400">
          {clients.length} client{clients.length === 1 ? "" : "s"} · built from your jobs
        </p>
      </header>

      <div className="relative mb-3">
        <input
          className="input pl-10"
          placeholder="Search name, email, phone, address…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <svg className="absolute left-3 top-3 h-5 w-5 text-stone-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" strokeLinecap="round" />
        </svg>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 skeleton rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">👤</span>}
          title={clients.length === 0 ? "No clients yet" : "No matches"}
          subtitle={clients.length === 0 ? "Clients appear here automatically as jobs come in." : "No clients match your search."}
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelected(c)}
              className={`card flex w-full items-center gap-3 border-l-4 p-3.5 text-left transition active:scale-[0.99] ${
                companyPalette({ leadSource: c.leadSource, clientName: c.name, clientEmail: c.email }).bar
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-bold text-stone-500 dark:bg-night-800 dark:text-slate-400">
                {initials(c.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900 dark:text-slate-100">{c.name}</p>
                <p className="truncate text-xs text-stone-500 dark:text-slate-400">{c.email || c.phone || c.address || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-stone-800 dark:text-slate-100">{fmtMoney(c.totalValue, c.currency)}</p>
                <p className="text-xs text-stone-400 dark:text-slate-500">
                  {c.jobCount} job{c.jobCount === 1 ? "" : "s"}
                  {c.activeCount > 0 && <span className="text-emerald-600 dark:text-emerald-300"> · {c.activeCount} active</span>}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Client"}>
        {selected && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-1.5 font-medium text-stone-700 dark:bg-night-800 dark:text-slate-200">
                  ✉️ {selected.email}
                </a>
              )}
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 px-3 py-1.5 font-medium text-stone-700 dark:bg-night-800 dark:text-slate-200">
                  📞 {selected.phone}
                </a>
              )}
            </div>
            {selected.address && <p className="text-sm text-stone-500 dark:text-slate-400">📍 {selected.address}</p>}

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Jobs" value={String(selected.jobCount)} />
              <Stat label="Active" value={String(selected.activeCount)} />
              <Stat label="Value" value={fmtMoney(selected.totalValue, selected.currency)} />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-400 dark:text-slate-500">Jobs</p>
              <div className="card divide-y divide-stone-100 dark:divide-night-line2">
                {selected.jobs.map((j) => (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    className="flex items-center gap-3 px-3.5 py-2.5 active:bg-stone-50 dark:active:bg-night-800"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-900 dark:text-slate-100">{j.title}</p>
                      <p className="truncate text-xs text-stone-500 dark:text-slate-400">
                        {j.reference} · {fmtDay(j.scheduledStart)}
                      </p>
                    </div>
                    {j.quoteAmount != null && (
                      <span className="shrink-0 text-xs font-medium text-stone-600 dark:text-slate-300">{fmtMoney(j.quoteAmount, j.currency)}</span>
                    )}
                    <StatusPill status={j.status} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2 dark:bg-night-850">
      <div className="text-sm font-bold text-stone-900 dark:text-slate-100">{value}</div>
      <div className="text-[11px] text-stone-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
