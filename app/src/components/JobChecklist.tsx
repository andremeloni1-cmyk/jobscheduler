"use client";

import { useEffect, useState } from "react";
import { api, type JobDTO, type ChecklistItem } from "@/lib/job";

let counter = 0;
const newId = () => `it_${Date.now()}_${counter++}`;

export function JobChecklist({
  job,
  onMessage,
}: {
  job: JobDTO;
  onMessage?: (m: string) => void;
}) {
  const [items, setItems] = useState<ChecklistItem[]>(job.checklist || []);
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);

  // Reseed when navigating to a different job.
  useEffect(() => {
    setItems(job.checklist || []);
  }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  // Persist the whole list (optimistic — local state is already updated).
  async function save(next: ChecklistItem[]) {
    setItems(next);
    try {
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify({ checklist: next }) });
    } catch {
      onMessage?.("Couldn't save the to-do list — check your connection.");
    }
  }

  function toggle(id: string) {
    save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }
  function remove(id: string) {
    save(items.filter((i) => i.id !== id));
  }
  function add() {
    const t = text.trim();
    if (!t) return;
    save([...items, { id: newId(), text: t, done: false }]);
    setText("");
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await api<{ items: string[]; message?: string }>(
        `/api/jobs/${job.id}/checklist/generate`,
        { method: "POST" }
      );
      if (!res.items?.length) {
        onMessage?.(res.message || "No steps suggested.");
        return;
      }
      // Append only steps we don't already have (case-insensitive).
      const have = new Set(items.map((i) => i.text.toLowerCase()));
      const fresh = res.items
        .filter((t) => t && !have.has(t.toLowerCase()))
        .map((t) => ({ id: newId(), text: t, done: false }));
      if (!fresh.length) {
        onMessage?.("Those steps are already on the list.");
        return;
      }
      await save([...items, ...fresh]);
      onMessage?.(`Added ${fresh.length} step${fresh.length === 1 ? "" : "s"} from the job details.`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      {/* Progress */}
      {items.length > 0 && (
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>{done} of {items.length} done</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-night-800">
            <div className="grow-x h-full rounded-full bg-brand-500 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Items */}
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="group flex items-center gap-3">
              <button
                onClick={() => toggle(it.id)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition ${
                  it.done
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-slate-300 text-transparent dark:border-night-line"
                }`}
                aria-label={it.done ? "Mark not done" : "Mark done"}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className={`flex-1 text-sm ${it.done ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-800 dark:text-slate-100"}`}>
                {it.text}
              </span>
              <button
                onClick={() => remove(it.id)}
                aria-label="Remove"
                className="shrink-0 rounded-full p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500 dark:text-slate-600 dark:hover:bg-night-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          No to-dos yet. Add steps below, or draft them from the job details.
        </p>
      )}

      {/* Add a step */}
      <div className="mt-3 flex gap-2">
        <input
          className="input"
          placeholder="Add a step…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="btn-secondary shrink-0 px-4" onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>

      {/* AI draft */}
      <button
        onClick={generate}
        disabled={generating}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 disabled:opacity-50 dark:text-brand-300"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" strokeLinejoin="round" />
        </svg>
        {generating ? "Drafting…" : items.length ? "Draft more from job details" : "Draft from job details"}
      </button>
    </div>
  );
}
