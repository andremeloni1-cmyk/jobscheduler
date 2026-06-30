import Anthropic from "@anthropic-ai/sdk";
import { visionConfigured } from "@/lib/vision";

export type ChecklistContext = {
  title: string;
  description?: string | null;
  address?: string | null;
};

/**
 * Turns a job's title + description into a short, ordered on-site to-do list a
 * joiner would tick off while the job is in progress. Returns plain step
 * strings (5-12), or null when AI isn't configured / on error so callers can
 * fall back gracefully.
 */
export async function generateChecklist(ctx: ChecklistContext): Promise<string[] | null> {
  if (!visionConfigured()) return null;

  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

  const facts = [
    `Job title: ${ctx.title}`,
    ctx.address ? `Site address: ${ctx.address}` : "",
    ctx.description ? `Job details:\n${ctx.description}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content:
            "You are helping a joiner build a practical on-site TO-DO list for a job that's about to be (or is being) " +
            "worked on — e.g. a kitchen, bathroom, laundry, or wardrobe installation. Base the steps strictly on the " +
            "job context below; don't invent measurements, prices, or rooms that aren't implied. Write each step as a " +
            "short, actionable task the fitter ticks off (e.g. \"Check delivery against packing list\", \"Fit base " +
            "cabinets & level\", \"Install benchtop\", \"Connect sink & test for leaks\", \"Align doors & drawers\", " +
            "\"Silicone & seal\", \"Clean site & remove rubbish\"). Order them the way the work actually happens.\n\n" +
            `--- JOB CONTEXT ---\n${facts}\n--- END CONTEXT ---\n\n` +
            "Respond as JSON: { items: string[] } with 5-12 concise steps. No numbering or punctuation prefixes.",
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              items: { type: "array", items: { type: "string" } },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") return null;
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    const raw = JSON.parse(text.text) as { items?: unknown };
    if (!Array.isArray(raw.items)) return null;
    return raw.items
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return null;
  }
}
