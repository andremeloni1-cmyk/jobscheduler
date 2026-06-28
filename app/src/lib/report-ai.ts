import Anthropic from "@anthropic-ai/sdk";
import { visionConfigured } from "@/lib/vision";
import type { ReportData } from "@/lib/pdf";

export type ReportContext = {
  title: string;
  description?: string | null;
  address?: string | null;
  clientName?: string | null;
  documents?: string[]; // document names for extra hints
};

/**
 * Drafts a maintenance/handover report from a job's context using Claude,
 * broken down by room where the work spans multiple rooms. Returns null when
 * AI is not configured or on error.
 */
export async function draftReport(ctx: ReportContext): Promise<ReportData | null> {
  if (!visionConfigured()) return null;

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const facts = [
    `Job title: ${ctx.title}`,
    ctx.address ? `Site address: ${ctx.address}` : "",
    ctx.clientName ? `Client: ${ctx.clientName}` : "",
    ctx.description ? `Job details:\n${ctx.description}` : "",
    ctx.documents && ctx.documents.length ? `Attached documents: ${ctx.documents.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content:
            "You are drafting a professional maintenance / handover report for a completed joinery job, " +
            "for the joiner to review, edit, and send to the client. Base it strictly on the job context below — " +
            "do not invent measurements, prices, or facts that aren't implied. Where the work spans multiple rooms " +
            "or areas, split the work into a per-room breakdown. Keep language clear and client-friendly.\n\n" +
            `--- JOB CONTEXT ---\n${facts}\n--- END CONTEXT ---\n\n` +
            "Respond as JSON with: workCarried (overall summary), rooms (array of {name, work} — one per room/area, " +
            "omit if single-area), materialsUsed, findings, recommendations, condition (one of: Good, Fair, Needs attention). " +
            "Leave a field as an empty string if there isn't enough information.",
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              workCarried: { type: "string" },
              materialsUsed: { type: "string" },
              findings: { type: "string" },
              recommendations: { type: "string" },
              condition: { type: "string" },
              rooms: {
                type: "array",
                items: {
                  type: "object",
                  properties: { name: { type: "string" }, work: { type: "string" } },
                  required: ["name", "work"],
                  additionalProperties: false,
                },
              },
            },
            required: ["workCarried"],
            additionalProperties: false,
          },
        },
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") return null;
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const parsed = JSON.parse(text.text) as ReportData;
    return parsed;
  } catch {
    return null;
  }
}
