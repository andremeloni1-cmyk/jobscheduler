"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/job";

type Template = { key: string; subject: string; body: string; enabled: boolean };
type SettingsData = {
  account: { name: string | null; email: string; googleEmail: string | null; calendarId: string } | null;
  templates: Template[];
  google: { configured: boolean; connected: boolean };
};

const TEMPLATE_LABELS: Record<string, string> = {
  accepted: "Job accepted",
  moved: "Job rescheduled",
  cancelled: "Job cancelled",
  report: "Maintenance report",
};

type LeadSource = { id: string; name: string; email: string; enabled: boolean };

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceEmail, setNewSourceEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const d = await api<SettingsData>("/api/settings");
    setData(d);
    setName(d.account?.name || "");
    setTemplates(d.templates);
    try {
      const ls = await api<{ sources: LeadSource[] }>("/api/lead-sources");
      setSources(ls.sources);
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleSource(s: LeadSource) {
    setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)));
    await api(`/api/lead-sources/${s.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !s.enabled }) });
  }
  async function deleteSource(s: LeadSource) {
    if (!confirm(`Stop watching ${s.email}?`)) return;
    setSources((prev) => prev.filter((x) => x.id !== s.id));
    await api(`/api/lead-sources/${s.id}`, { method: "DELETE" });
  }
  async function addSource() {
    const email = newSourceEmail.trim().toLowerCase();
    if (!email.includes("@")) return;
    const { source } = await api<{ source: LeadSource }>("/api/lead-sources", {
      method: "POST",
      body: JSON.stringify({ email, name: newSourceName.trim() || email }),
    });
    setSources((prev) => [...prev.filter((x) => x.id !== source.id), source]);
    setNewSourceName("");
    setNewSourceEmail("");
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) setMsg("Google account connected ✓");
    if (params.get("error")) setMsg(`Couldn't connect Google: ${params.get("error")}`);
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ account: { name }, templates }),
      });
      setMsg("Saved ✓");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    await api("/api/auth/google/disconnect", { method: "POST" });
    await load();
  }

  async function logout() {
    await fetch("/api/auth/login", { method: "DELETE" });
    window.location.href = "/login";
  }

  function updateTemplate(key: string, patch: Partial<Template>) {
    setTemplates((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }

  if (!data) return <div className="px-4 pt-6 text-stone-400">Loading…</div>;

  return (
    <div className="px-4 pt-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight text-stone-900">Settings</h1>

      {msg && <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{msg}</div>}

      {/* Google connection */}
      <div className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold text-stone-900">Google integration</h2>
        <p className="mb-3 text-sm text-stone-500">
          Connect your Google account to sync jobs to Calendar, save PDFs to Drive and send client emails from Gmail.
        </p>

        {!data.google.configured ? (
          <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Google isn’t configured on the server yet. Add <code>GOOGLE_CLIENT_ID</code> and{" "}
            <code>GOOGLE_CLIENT_SECRET</code> to your environment (see the README), then restart the app.
          </div>
        ) : data.google.connected ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-stone-700">Connected{data.account?.googleEmail ? ` as ${data.account.googleEmail}` : ""}</span>
            </div>
            <button className="btn-secondary" onClick={disconnect}>
              Disconnect
            </button>
          </div>
        ) : (
          <a href="/api/auth/google" className="btn-primary w-full">
            Connect Google account
          </a>
        )}
        {!data.google.connected && data.google.configured && (
          <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
            Until connected, the app runs in <strong>demo mode</strong>: everything works locally, but nothing is pushed to
            Google.
          </p>
        )}
      </div>

      {/* Incoming job sources */}
      <div className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold text-stone-900">Incoming jobs</h2>
        <p className="mb-3 text-sm text-stone-500">
          Emails from these senders become job leads for you to approve. Add a whole{" "}
          <strong>company domain</strong> (e.g. <code>miikitchen.com.au</code>) to catch every staff member, or a
          specific email address. The app checks automatically, or tap “Check inbox for new jobs” on the Jobs screen.
        </p>
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 rounded-xl bg-stone-50 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800">{s.name}</p>
                <p className="truncate text-xs text-stone-500">{s.email}</p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-stone-500">
                <input type="checkbox" checked={s.enabled} onChange={() => toggleSource(s)} className="h-4 w-4 accent-brand-600" />
                On
              </label>
              <button onClick={() => deleteSource(s)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-200" aria-label="Remove">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}
          {sources.length === 0 && <p className="text-sm text-stone-400">No senders yet — add one below.</p>}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input className="input" placeholder="Company name" value={newSourceName} onChange={(e) => setNewSourceName(e.target.value)} />
          <input className="input" placeholder="company.com or email@company.com" value={newSourceEmail} onChange={(e) => setNewSourceEmail(e.target.value)} />
          <button className="btn-secondary" onClick={addSource}>Add</button>
        </div>
      </div>

      {/* Account */}
      <div className="card mb-4 p-4">
        <h2 className="mb-3 font-semibold text-stone-900">Your business</h2>
        <label className="label">Name (used in emails & reports)</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meloni Joinery" />
      </div>

      {/* Email templates */}
      <div className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold text-stone-900">Automated emails</h2>
        <p className="mb-3 text-sm text-stone-500">
          Sent automatically to clients. Use placeholders like{" "}
          <code>{"{{clientName}}"}</code>, <code>{"{{jobTitle}}"}</code>, <code>{"{{startDate}}"}</code>,{" "}
          <code>{"{{startTime}}"}</code>, <code>{"{{address}}"}</code>, <code>{"{{reference}}"}</code>.
        </p>
        <div className="space-y-4">
          {templates.map((t) => (
            <details key={t.key} className="rounded-xl border border-stone-200">
              <summary className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-sm font-semibold text-stone-800">
                {TEMPLATE_LABELS[t.key] || t.key}
                <label className="flex items-center gap-2 text-xs font-normal text-stone-500" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={t.enabled}
                    onChange={(e) => updateTemplate(t.key, { enabled: e.target.checked })}
                    className="h-4 w-4 accent-brand-600"
                  />
                  Enabled
                </label>
              </summary>
              <div className="space-y-2 px-3 pb-3">
                <input
                  className="input"
                  value={t.subject}
                  onChange={(e) => updateTemplate(t.key, { subject: e.target.value })}
                  placeholder="Subject"
                />
                <textarea
                  className="input"
                  rows={6}
                  value={t.body}
                  onChange={(e) => updateTemplate(t.key, { body: e.target.value })}
                />
              </div>
            </details>
          ))}
        </div>
      </div>

      <button className="btn-primary mb-4 w-full" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>

      <button className="btn-ghost w-full text-stone-500" onClick={logout}>
        Log out
      </button>

      <p className="mt-6 text-center text-xs text-stone-300">JoineryFlow · v1.0</p>
    </div>
  );
}
