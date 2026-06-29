import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

export type ChecklistItem = { label: string; done: boolean };
export type RoomEntry = { name: string; work?: string; items?: ChecklistItem[] };

export type ReportData = {
  scope?: string; // e.g. "Kitchen installation"
  jobType?: string; // kitchen | bathroom | laundry | wardrobe | other
  driveImagesLink?: string; // Google Drive link to site photos
  signOffName?: string; // client sign-off
  signOffDate?: string;
  engineer?: string;
  visitDate?: string;
  workCarried?: string;
  findings?: string;
  recommendations?: string;
  materialsUsed?: string;
  followUp?: string;
  condition?: string; // Good | Fair | Needs attention
  nextServiceDate?: string;
  rooms?: RoomEntry[]; // per-room breakdown + completion checklist
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

  // Draws a single line of blue, underlined, clickable link text and advances y.
  const link = (label: string, url: string, size = 11, lh = 18) => {
    ensureSpace(lh);
    const LINK = rgb(0.13, 0.39, 0.78);
    const w = font.widthOfTextAtSize(label, size);
    page.drawText(label, { x: margin, y, size, font, color: LINK });
    page.drawLine({
      start: { x: margin, y: y - 1.5 },
      end: { x: margin + w, y: y - 1.5 },
      thickness: 0.6,
      color: LINK,
    });
    // Clickable hit-area annotation over the text.
    const annot = pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [margin, y - 3, margin + w, y + size],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    });
    const ref = pdf.context.register(annot);
    const existing = page.node.Annots();
    if (existing) existing.push(ref);
    else page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
    y -= lh;
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
    ...((data.scope ? [["Scope", data.scope]] : []) as [string, string][]),
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

  // Per-room breakdown with completion checklist
  if (data.rooms && data.rooms.length > 0) {
    ensureSpace(34);
    page.drawText("Work by room", { x: margin, y, size: 12, font: bold, color: BRAND });
    y -= 18;
    for (const room of data.rooms) {
      const items = room.items || [];
      if (!room.name && !room.work && items.length === 0) continue;
      const done = items.filter((it) => it.done).length;
      ensureSpace(20);
      page.drawText(room.name || "Room", { x: margin, y, size: 11, font: bold, color: INK });
      if (items.length > 0) {
        page.drawText(`${done}/${items.length} complete`, { x: margin + 200, y, size: 9, font, color: MUTED });
      }
      y -= 15;
      if (room.work) paragraph(room.work);
      // Checklist — ASCII boxes so the standard font can always render them.
      for (const it of items) {
        ensureSpace(15);
        page.drawText(`${it.done ? "[x]" : "[ ]"} ${it.label}`, { x: margin + 8, y, size: 10, font, color: INK });
        y -= 15;
      }
      // Outstanding items.
      const outstanding = items.filter((it) => !it.done);
      if (outstanding.length > 0) {
        ensureSpace(16);
        page.drawText("To be completed:", { x: margin + 8, y, size: 10, font: bold, color: rgb(0.7, 0.4, 0.1) });
        y -= 14;
        for (const it of outstanding) {
          ensureSpace(14);
          page.drawText(`- ${it.label}`, { x: margin + 16, y, size: 10, font, color: INK });
          y -= 14;
        }
      }
      y -= 8;
    }
    y -= 4;
  }

  section("Findings", data.findings);
  section("Materials used", data.materialsUsed);
  section("Recommendations", data.recommendations);
  if (data.driveImagesLink) {
    ensureSpace(40);
    page.drawText("Site photos", { x: margin, y, size: 12, font: bold, color: BRAND });
    y -= 18;
    link("View site photos on Google Drive", data.driveImagesLink);
    y -= 10;
  }

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
  y -= 56;

  // Client sign-off (handover acceptance)
  ensureSpace(50);
  y -= 24;
  page.drawText("Signed (client):", { x: margin, y, size: 11, font: bold, color: INK });
  page.drawText(data.signOffName || "________________________", { x: margin + 100, y, size: 11, font, color: INK });
  page.drawText("Date:", { x: width - margin - 160, y, size: 11, font: bold, color: INK });
  page.drawText(data.signOffDate || "____________", { x: width - margin - 120, y, size: 11, font, color: INK });

  // Footer
  page.drawText(
    `Generated by JoineryFlow • ${new Date().toLocaleDateString("en-GB")}`,
    { x: margin, y: margin - 20, size: 9, font, color: MUTED }
  );

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
