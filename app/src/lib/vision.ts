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
