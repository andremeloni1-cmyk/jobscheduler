import type { ChecklistItem } from "@/lib/job";

/** Compact "done/total" to-do indicator for job cards and the Today screen.
 * Renders nothing when the job has no checklist. Turns green once everything's
 * ticked off. */
export function ChecklistBadge({ checklist }: { checklist?: ChecklistItem[] | null }) {
  const items = checklist || [];
  if (items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const complete = done === items.length;
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium ${
        complete ? "text-emerald-600 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"
      }`}
      title={`${done} of ${items.length} to-dos done`}
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {complete ? (
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <path d="M8 12l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </svg>
      {done}/{items.length}
    </span>
  );
}
