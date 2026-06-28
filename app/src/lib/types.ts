// Shared constants and helpers for job statuses & lifecycle.

// Lifecycle: an incoming job is "lead" (To confirm) until the owner confirms it
// → accepted → scheduled → in_progress → completed (cancelled from any state).
// There is no quoting step — jobs only need confirming.
export const JOB_STATUSES = [
  "lead",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  lead: "To confirm",
  accepted: "Confirmed",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Tailwind classes for status pills.
export const STATUS_STYLES: Record<JobStatus, string> = {
  lead: "bg-amber-50 text-amber-700 ring-amber-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  scheduled: "bg-brand-100 text-brand-800 ring-brand-200",
  in_progress: "bg-amber-50 text-amber-700 ring-amber-200",
  completed: "bg-green-100 text-green-800 ring-green-300",
  cancelled: "bg-red-50 text-red-700 ring-red-200",
};

// Which statuses should appear on the calendar (i.e. have a confirmed slot).
export const SCHEDULED_STATUSES: JobStatus[] = [
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
];

export const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-stone-100 text-stone-500",
  normal: "bg-sky-100 text-sky-700",
  high: "bg-red-100 text-red-700",
};

export function isScheduledStatus(s: string): boolean {
  return SCHEDULED_STATUSES.includes(s as JobStatus);
}
