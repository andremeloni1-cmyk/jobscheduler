import type { ChecklistItem } from "@/lib/job";

/** Parse the JSON checklist stored on Job.checklist into a clean array.
 * Tolerates nulls / malformed JSON / legacy shapes — always returns an array. */
export function parseChecklist(raw: string | null | undefined): ChecklistItem[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it, i) => ({
        id: typeof it?.id === "string" && it.id ? it.id : `it_${i}`,
        text: String(it?.text ?? "").trim(),
        done: Boolean(it?.done),
      }))
      .filter((it) => it.text);
  } catch {
    return [];
  }
}

/** Normalise an incoming checklist (from the client) into the string stored in
 * the DB. Returns null for an empty list so the column stays tidy. Caps size so
 * a bad client can't bloat the row. */
export function serializeChecklist(input: unknown): string | null {
  if (!Array.isArray(input)) return null;
  const items: ChecklistItem[] = input
    .map((it: { id?: unknown; text?: unknown; done?: unknown }, i: number) => ({
      id: typeof it?.id === "string" && it.id ? it.id : `it_${i}_${Date.now()}`,
      text: String(it?.text ?? "").trim().slice(0, 300),
      done: Boolean(it?.done),
    }))
    .filter((it) => it.text)
    .slice(0, 100);
  return items.length ? JSON.stringify(items) : null;
}
