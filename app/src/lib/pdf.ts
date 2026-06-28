import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type RoomEntry = { name: string; work: string };

export type ReportData = {
  engineer?: string;
  visitDate?: string;
  workCarried?: string;
  findings?: string;
  recommendations?: string;
  materialsUsed?: string;
  followUp?: string;
  condition?: string; // Good | Fair | Needs attention
  nextServiceDate?: string;
  rooms?: RoomEntry[]; // per-room breakdown of the work
};

type Meta = {
  jobTitle: string;
  reference: string;
  clientName?: string | null;
  address?: string | null;
  ownerName?: string | null;
};

const BRAND = rgb(0.63, 0.36, 0.15); // joinery timber tone
const INK = rgb(0.12, 0.1, 0.09);
const MUTED = rgb(0.4, 0.38, 0.36);

/** Generates a clean A4 maintenance report PDF and returns the bytes. */
export async function generateReportPdf(meta: Meta, data: ReportData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  // Start a new page if there isn't room for `needed` vertical points.
  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - margin;
    }
  };

  const text = (
    s: string,
    opts: { size?: number; font?: typeof font; color?: typeof INK; x?: number } = {}
  ) => {
    page.drawText(s, {
      x: opts.x ?? margin,
      y,
      size: opts.size ?? 11,
      font: opts.font ?? font,
      color: opts.color ?? INK,
    });
  };

  // Wrap long text into lines and draw them, advancing y.
  const paragraph = (s: string, size = 11, lh = 16) => {
    const maxWidth = width - margin * 2;
    const words = (s || "—").split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (const l of lines) {
      ensureSpace(lh);
      page.drawText(l, { x: margin, y, size, font, color: INK });
      y -= lh;
    }
  };

  // Header band
  page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: BRAND });
  page.drawText("Maintenance Report", {
    x: margin,
    y: height - 56,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(meta.ownerName || "JoineryFlow", {
    x: margin,
    y: height - 76,
    size: 11,
    font,
    color: rgb(1, 1, 1),
  });

  y = height - 120;

  // Job meta block
  const metaRows: [string, string][] = [
    ["Job", `${meta.jobTitle}`],
    ["Reference", meta.reference],
    ["Client", meta.clientName || "—"],
    ["Address", meta.address || "—"],
    ["Visit date", data.visitDate || "—"],
    ["Engineer", data.engineer || "—"],
  ];
  for (const [k, v] of metaRows) {
    page.drawText(`${k}:`, { x: margin, y, size: 10, font: bold, color: MUTED });
    page.drawText(v, { x: margin + 95, y, size: 10, font, color: INK });
    y -= 16;
  }

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.88, 0.85, 0.82),
  });
  y -= 24;

  const section = (heading: string, body?: string) => {
    ensureSpace(34);
    page.drawText(heading, { x: margin, y, size: 12, font: bold, color: BRAND });
    y -= 18;
    paragraph(body || "—");
    y -= 10;
  };

  section("Work carried out", data.workCarried);

  // Per-room breakdown
  if (data.rooms && data.rooms.length > 0) {
    ensureSpace(34);
    page.drawText("Work by room", { x: margin, y, size: 12, font: bold, color: BRAND });
    y -= 18;
    for (const room of data.rooms) {
      if (!room.name && !room.work) continue;
      ensureSpace(20);
      page.drawText(room.name || "Room", { x: margin, y, size: 11, font: bold, color: INK });
      y -= 15;
      paragraph(room.work || "—");
      y -= 8;
    }
    y -= 4;
  }

  section("Findings", data.findings);
  section("Materials used", data.materialsUsed);
  section("Recommendations", data.recommendations);

  // Condition + next service summary box
  ensureSpace(72);
  y -= 6;
  page.drawRectangle({
    x: margin,
    y: y - 56,
    width: width - margin * 2,
    height: 56,
    color: rgb(0.98, 0.96, 0.93),
    borderColor: rgb(0.9, 0.86, 0.8),
    borderWidth: 1,
  });
  page.drawText("Overall condition:", { x: margin + 12, y: y - 22, size: 11, font: bold, color: INK });
  page.drawText(data.condition || "—", { x: margin + 130, y: y - 22, size: 11, font, color: INK });
  page.drawText("Next service due:", { x: margin + 12, y: y - 42, size: 11, font: bold, color: INK });
  page.drawText(data.nextServiceDate || "—", { x: margin + 130, y: y - 42, size: 11, font, color: INK });

  // Footer
  page.drawText(
    `Generated by JoineryFlow • ${new Date().toLocaleDateString("en-GB")}`,
    { x: margin, y: margin - 20, size: 9, font, color: MUTED }
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
