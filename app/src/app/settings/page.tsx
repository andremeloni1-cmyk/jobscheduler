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

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [name, setName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const d = await api<SettingsData>("/api/settings");
    setData(d);
    setName(d.account?.name || "");
    setTemplates(d.templates);
  }
  useEffect(() => {
    load();
  }, []);

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
