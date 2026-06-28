import { prisma } from "@/lib/db";

/** Generates the next human-friendly job reference, e.g. JOB-1042.
 * Uses the highest existing number (not the most recent row) so it stays
 * collision-free even when references are created out of timestamp order. */
export async function nextReference(): Promise<string> {
  const all = await prisma.job.findMany({ select: { reference: true } });
  let max = 1000;
  for (const j of all) {
    const m = j.reference?.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `JOB-${max + 1}`;
}

export function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? null : d;
}

export function json<T>(data: T, init?: number | ResponseInit): Response {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return new Response(JSON.stringify(data), {
    ...responseInit,
    headers: { "content-type": "application/json", ...(responseInit as ResponseInit)?.headers },
  });
}
