import { prisma } from "@/lib/db";

/** Generates the next human-friendly job reference, e.g. JOB-1042. */
export async function nextReference(): Promise<string> {
  const last = await prisma.job.findFirst({
    orderBy: { createdAt: "desc" },
    select: { reference: true },
  });
  let n = 1000;
  if (last?.reference) {
    const m = last.reference.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10);
  }
  return `JOB-${n + 1}`;
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
