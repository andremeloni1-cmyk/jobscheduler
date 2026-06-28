import Anthropic from "@anthropic-ai/sdk";

// Reads job-detail images (PNG/JPG/etc.) with Claude vision and extracts a
// clean title + description. Returns null when not configured (no API key) or
// on error, so the caller falls back to the email body.

export type JobImage = { filename: string; data: Buffer; mimeType: string };

const SUPPORTED: Record<string, "image/png" | "image/jpeg" | "image/gif" | "image/webp"> = {
  "image/png": "image/png",
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export function visionConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function mediaType(mime: string): "image/png" | "image/jpeg" | "image/gif" | "image/webp" | null {
  return SUPPORTED[mime.toLowerCase()] || null;
}

export type ExtractedJob = {
  title: string;
  description: string;
  address?: string;
  date?: string; // YYYY-MM-DD if a date is stated
  time?: string; // HH:mm 24h if a time is stated
  durationMins?: number;
};

/**
 * Reads a job enquiry email (text + any attached images) and splits it into the
 * separate jobs it contains, each with its own details. Returns null when AI is
 * not configured or on error, [] when no jobs could be extracted.
 */
export async function extractJobsFromEmail(input: {
  subject: string;
  body: string;
  images: JobImage[];
  pdfs?: JobImage[];
}): Promise<ExtractedJob[] | null> {
  if (!visionConfigured()) return null;

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const content: Anthropic.ContentBlockParam[] = input.images
    .map((img) => ({ ...img, media: mediaType(img.mimeType) }))
    .filter((img) => img.media)
    .slice(0, 16)
    .map((img) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: img.media!, data: img.data.toString("base64") },
    }));

  // Attach PDFs (drawings / purchase orders) as documents so the model can read
  // site addresses, PO numbers, etc. Cap to keep the request well under limits.
  for (const pdf of (input.pdfs || []).slice(0, 5)) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdf.data.toString("base64") },
    } as Anthropic.ContentBlockParam);
  }

  content.push({
    type: "text",
    text:
      "This is a job enquiry email (with any attached images) from a kitchen/joinery company. " +
      "It may describe ONE OR MORE separate jobs (e.g. different sites, rooms, or line items). " +
      "Identify each DISTINCT job and extract it. For each job capture: a short title; a description " +
      "with all relevant details (measurements, materials, quantities, room/area, reference numbers); " +
      "the site address if stated; a date (YYYY-MM-DD) and time (HH:mm, 24h) ONLY if explicitly given; " +
      "and an estimated durationMins if obvious. Do not invent dates, addresses, or measurements that " +
      "aren't present.\n\n" +
      `Email subject: ${input.subject}\n\nEmail body:\n${input.body || "(no text body)"}\n\n` +
      "Respond as JSON: { jobs: [ { title, description, address, date, time, durationMins } ] }. " +
      "If it's really just one job, return a single-element array.",
  });

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 2000,
      messages: [{ role: "user", content }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              jobs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    address: { type: "string" },
                    date: { type: "string" },
                    time: { type: "string" },
                    durationMins: { type: "number" },
                  },
                  required: ["title", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["jobs"],
            additionalProperties: false,
          },
        },
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") return null;
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as { jobs?: ExtractedJob[] };
    return Array.isArray(parsed.jobs) ? parsed.jobs.slice(0, 20) : [];
  } catch {
    return null;
  }
}

export async function analyzeJobImages(
  images: JobImage[]
): Promise<{ title?: string; description: string } | null> {
  if (!visionConfigured()) return null;

  const usable = images
    .map((img) => ({ ...img, media: mediaType(img.mimeType) }))
    .filter((img) => img.media);
  if (usable.length === 0) return null;

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const content: Anthropic.ContentBlockParam[] = usable.map((img) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.media!, data: img.data.toString("base64") },
  }));
  content.push({
    type: "text",
    text:
      "These image(s) are attachments from a joinery job enquiry emailed by a kitchen/joinery company. " +
      "Read them and extract the job details a joiner would need. Capture measurements, materials, " +
      "quantities, room/location, the client or site address, and any reference/order numbers shown. " +
      "Respond as JSON with `title` (a short job title, max ~60 chars) and `description` " +
      "(a clear plain-text brief of the work required). Omit a field only if nothing relevant is visible.",
  });

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [{ role: "user", content }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
            },
            required: ["description"],
            additionalProperties: false,
          },
        },
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") return null;
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as { title?: string; description?: string };
    if (!parsed.description) return null;
    return { title: parsed.title?.trim() || undefined, description: parsed.description.trim() };
  } catch {
    return null;
  }
}
