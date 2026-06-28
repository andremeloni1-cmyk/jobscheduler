"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/job";
import { NotificationsCard } from "@/components/NotificationsCard";

type Template = { key: string; subject: string; body: string; enabled: boolean };
type SettingsData = {
  account: { name: string | null; email: string; googleEmail: string | null; calendarId: string; signature?: string | null; logo?: string | null; logoMime?: string | null } | null;
  templates: Template[];
  google: { configured: boolean; connected: boolean };
  ai?: { configured: boolean };
};

const TEMPLATE_LABELS: Record<string, string> = {
  accepted: "Job accepted",
  moved: "Job rescheduled",
  cancelled: "Job cancelled",
  report: "Maintenance report",
};

type LeadSource = { id: string; name: string; email: string; enabled: boolean; templates?: string | null };

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [name, setName] = useState("");
  const [signature, setSignature] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [logoMime, setLogoMime] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceEmail, setNewSourceEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function dedupeDrive() {
    setDeduping(true);
    setMsg(null);
    try {
      const r = await api<{ filesRemoved: number; foldersScanned: number }>("/api/maintenance/dedupe-drive", { method: "POST" });
      setMsg(`Cleaned up ${r.filesRemoved} duplicate file(s) across ${r.foldersScanned} folder(s).`);
    } catch {
      setMsg("Couldn't clean up duplicates just now.");
    } finally {
      setDeduping(false);
    }
  }

  async function load() {
    const d = await api<SettingsData>("/api/settings");
    setData(d);
    setName(d.account?.name || "");
    setSignature(d.account?.signature || "");
    setLogo(d.account?.logo || null);
    setLogoMime(d.account?.logoMime || null);
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
    // Optimistically remove; reload from the server if the delete fails so the
    // list reflects real state. (No window.confirm — unreliable in standalone PWAs.)
    setSources((prev) => prev.filter((x) => x.id !== s.id));
    try {
      await api(`/api/lead-sources/${s.id}`, { method: "DELETE" });
    } catch {
      load();
    }
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
        body: JSON.stringify({ account: { name, signature, logo, logoMime }, templates }),
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

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 300 * 1024) {
      setMsg("Logo too large — please use an image under 300KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result); // data:<mime>;base64,<data>
      const comma = result.indexOf(",");
      setLogo(comma >= 0 ? result.slice(comma + 1) : result);
      setLogoMime(file.type || "image/png");
    };
    reader.readAsDataURL(file);
  }

  // Sample values so the preview shows what a real client would receive.
  const previewVars: Record<string, string> = {
    clientName: "Sarah Whitfield",
    jobTitle: "Kitchen worktop replacement",
    startDate: "Friday, 4 July 2026",
    startTime: "07:00",
    address: "14 Millbrook Lane, Bristol",
    reference: "JOB-1042",
    ownerName: name || "Your business",
  };
  function renderPreview(text: string): string {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => previewVars[k] ?? `{{${k}}}`);
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

      {/* Push notifications */}
      <NotificationsCard />

      {/* Drive cleanup */}
      {data.google.connected && (
        <div className="card mb-4 p-4">
          <h2 className="mb-1 font-semibold text-stone-900">Drive cleanup</h2>
          <p className="mb-3 text-sm text-stone-500">Remove duplicate files already sitting in your job folders (keeps the newest copy of each).</p>
          <button className="btn-secondary w-full" onClick={dedupeDrive} disabled={deduping}>
            {deduping ? "Cleaning up…" : "Remove duplicate Drive files"}
          </button>
        </div>
      )}

      {/* Incoming job sources */}
      <div className="card mb-4 p-4">
        <h2 className="mb-1 font-semibold text-stone-900">Incoming jobs</h2>
        <p className="mb-3 text-sm text-stone-500">
          Emails from these senders become job leads for you to approve. Add a whole{" "}
          <strong>company domain</strong> (e.g. <code>miikitchen.com.au</code>) to catch every staff member, or a
          specific email address. The app checks automatically, or tap “Check inbox for new jobs” on the Jobs screen.
        </p>

        {/* AI status — needed to split multi-job emails and read images/PDFs */}
        <div
          className={`mb-3 rounded-xl px-4 py-2.5 text-sm ${
            data.ai?.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {data.ai?.configured ? (
            <>✓ AI reading is on — multi-job emails are split and images/PDFs are read.</>
          ) : (
            <>AI reading is <strong>off</strong>. Add <code>ANTHROPIC_API_KEY</code> to the server <code>.env</code> and reload to split multi-job emails and read images/PDFs. Until then, each email becomes a single lead.</>
          )}
        </div>
        <div className="space-y-2">
          {sources.map((s) => (
            <div key={s.id} className="rounded-xl bg-stone-50 px-3 py-2.5">
              <div className="flex items-center gap-3">
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
              <SourceTemplates source={s} />
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
        <label className="label mt-3">Email signature</label>
        <textarea
          className="input"
          rows={3}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={"Added to the bottom of every client email, e.g.\nMeloni Joinery\n0400 000 000"}
        />
        <p className="mt-1 text-xs text-stone-400">Appended to all automated client emails. Save settings to apply.</p>

        <label className="label mt-3">Email logo</label>
        {logo ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:${logoMime || "image/png"};base64,${logo}`} alt="Email logo" className="max-h-16 rounded bg-white p-1 ring-1 ring-stone-200" />
            <button className="btn-secondary" onClick={() => { setLogo(null); setLogoMime(null); }}>Remove</button>
          </div>
        ) : (
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={onLogoFile} className="block w-full text-sm text-stone-600" />
        )}
        <p className="mt-1 text-xs text-stone-400">Shown under the signature in client emails. PNG/JPG under 300KB. Save settings to apply.</p>
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
                {/* Live preview — placeholders filled with sample client details */}
                <div className="rounded-xl bg-stone-50 p-3">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">Preview</p>
                  <p className="text-sm font-semibold text-stone-800">{renderPreview(t.subject) || "(no subject)"}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-stone-600">{renderPreview(t.body)}</p>
                </div>
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

type Override = { subject?: string; body?: string };
const OVERRIDE_KEYS: { key: string; label: string }[] = [
  { key: "accepted", label: "Job confirmed" },
  { key: "moved", label: "Rescheduled" },
  { key: "cancelled", label: "Cancelled" },
];

/** Per-company email wording overrides. Blank fields fall back to the defaults. */
function SourceTemplates({ source }: { source: LeadSource }) {
  const [tpl, setTpl] = useState<Record<string, Override>>(() => {
    try {
      return source.templates ? JSON.parse(source.templates) : {};
    } catch {
      return {};
    }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (k: string, f: keyof Override, v: string) =>
    setTpl((p) => ({ ...p, [k]: { ...(p[k] || {}), [f]: v } }));

  async function save() {
    setSaving(true);
    try {
      await api(`/api/lead-sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ templates: tpl }) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mt-2 rounded-lg border border-stone-200 bg-white">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-stone-600">Custom emails for this client</summary>
      <div className="space-y-3 px-3 pb-3">
        <p className="text-xs text-stone-400">
          Leave blank to use the defaults. Placeholders like <code>{"{{clientName}}"}</code> and <code>{"{{startDate}}"}</code> work here too.
        </p>
        {OVERRIDE_KEYS.map(({ key, label }) => (
          <div key={key}>
            <p className="text-xs font-semibold text-stone-600">{label}</p>
            <input
              className="input mt-1"
              placeholder="Subject (optional)"
              value={tpl[key]?.subject || ""}
              onChange={(e) => setField(key, "subject", e.target.value)}
            />
            <textarea
              className="input mt-1"
              rows={3}
              placeholder="Body (optional)"
              value={tpl[key]?.body || ""}
              onChange={(e) => setField(key, "body", e.target.value)}
            />
          </div>
        ))}
        <button className="btn-secondary w-full" onClick={save} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save custom emails"}
        </button>
      </div>
    </details>
  );
}
