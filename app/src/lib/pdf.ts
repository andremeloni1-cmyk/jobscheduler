import { PDFDocument, PDFFont, PDFName, PDFString, StandardFonts, rgb } from "pdf-lib";

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
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  logo?: string | null; // base64 (no data: prefix)
  logoMime?: string | null;
};

// Brand palette — black & white with a warm orange accent (matches the app).
const INK = rgb(0.09, 0.09, 0.09); // #171717
const ACCENT = rgb(0.949, 0.337, 0.169); // orange #F25623
const MUTED = rgb(0.302, 0.302, 0.302); // #4D4D4D
const HAIRLINE = rgb(0.871, 0.871, 0.871); // #DEDEDE
const LINKC = rgb(0.13, 0.39, 0.78);
const WHITE = rgb(1, 1, 1);

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const HEADER_H = 116;

type StatusKind = { bg: ReturnType<typeof rgb>; fg: ReturnType<typeof rgb> };
function conditionColors(condition?: string): StatusKind {
  const c = (condition || "").toLowerCase();
  if (c.includes("good")) return { bg: rgb(0.9, 0.97, 0.92), fg: rgb(0.13, 0.5, 0.28) };
  if (c.includes("fair")) return { bg: rgb(1, 0.96, 0.86), fg: rgb(0.6, 0.42, 0.05) };
  if (c.includes("attention") || c.includes("poor")) return { bg: rgb(1, 0.92, 0.92), fg: rgb(0.72, 0.18, 0.18) };
  return { bg: rgb(0.95, 0.95, 0.96), fg: INK };
}

/** Generates a clean, branded A4 maintenance report PDF and returns the bytes. */
export async function generateReportPdf(meta: Meta, data: ReportData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Optional business logo (PNG/JPG).
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (meta.logo) {
    try {
      const bytes = Buffer.from(meta.logo, "base64");
      logo = /jpe?g/i.test(meta.logoMime || "") ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
    } catch {
      try {
        logo = await pdf.embedJpg(Buffer.from(meta.logo, "base64"));
      } catch {
        logo = null;
      }
    }
  }

  let page = pdf.addPage(A4);
  const { width, height } = page.getSize();
  let y = 0;

  const rightX = (s: string, size: number, f: PDFFont) => width - MARGIN - f.widthOfTextAtSize(s, size);

  // Branded header band, drawn on the current page.
  const drawHeader = () => {
    page.drawRectangle({ x: 0, y: height - HEADER_H, width, height: HEADER_H, color: INK });
    page.drawRectangle({ x: 0, y: height - HEADER_H - 4, width, height: 4, color: ACCENT });

    let tx = MARGIN;
    if (logo) {
      const h = 30;
      const w = Math.min(150, (logo.width / logo.height) * h);
      page.drawImage(logo, { x: MARGIN, y: height - 44, width: w, height: h });
      tx = MARGIN; // business name sits below the logo
      page.drawText(meta.ownerName || "JoineryFlow", { x: tx, y: height - 64, size: 11, font, color: rgb(0.8, 0.8, 0.82) });
    } else {
      page.drawText((meta.ownerName || "JoineryFlow").toUpperCase(), {
        x: tx, y: height - 40, size: 12, font: bold, color: rgb(0.8, 0.8, 0.82),
      });
    }

    page.drawText("Maintenance Report", { x: MARGIN, y: height - 96, size: 23, font: bold, color: WHITE });

    // Right-aligned reference + visit date.
    const ref = meta.reference || "";
    page.drawText(ref, { x: rightX(ref, 12, bold), y: height - 40, size: 12, font: bold, color: WHITE });
    const dl = data.visitDate ? `Visit: ${data.visitDate}` : "";
    if (dl) page.drawText(dl, { x: rightX(dl, 9, font), y: height - 56, size: 9, font, color: rgb(0.8, 0.8, 0.82) });
  };

  drawHeader();
  y = height - HEADER_H - 28;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = height - MARGIN; // continuation pages start clean (no header band)
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 24) newPage();
  };

  const paragraph = (s: string, size = 10.5, lh = 15, color = INK, x = MARGIN) => {
    const maxWidth = width - x - MARGIN;
    const words = (s || "—").split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      ensureSpace(lh);
      page.drawText(l, { x, y, size, font, color });
      y -= lh;
    }
  };

  // Meta block: two-column key/value.
  const metaRows: [string, string][] = [
    ["Job", meta.jobTitle],
    ...((data.scope ? [["Scope", data.scope]] : []) as [string, string][]),
    ["Client", meta.clientName || "—"],
    ["Address", meta.address || "—"],
    ["Engineer", data.engineer || "—"],
    ["Visit date", data.visitDate || "—"],
  ];
  for (const [k, v] of metaRows) {
    ensureSpace(16);
    page.drawText(k.toUpperCase(), { x: MARGIN, y, size: 8, font: bold, color: MUTED });
    paragraphInline(v);
    y -= 17;
  }
  // Draws the value to the right of a fixed label column, wrapping if long.
  function paragraphInline(v: string) {
    const x = MARGIN + 92;
    const maxWidth = width - x - MARGIN;
    const words = v.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, 10.5) > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    page.drawText(lines[0] || "—", { x, y, size: 10.5, font, color: INK });
    for (let i = 1; i < lines.length; i++) {
      y -= 14;
      page.drawText(lines[i], { x, y, size: 10.5, font, color: INK });
    }
  }

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 1, color: HAIRLINE });
  y -= 26;

  // Section heading: orange accent tab + ink title + hairline rule.
  const heading = (h: string) => {
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: y - 1, width: 3, height: 13, color: ACCENT });
    page.drawText(h, { x: MARGIN + 10, y, size: 12.5, font: bold, color: INK });
    y -= 20;
  };
  const section = (h: string, body?: string) => {
    heading(h);
    paragraph(body || "—");
    y -= 12;
  };

  section("Work carried out", data.workCarried);

  if (data.rooms && data.rooms.length > 0) {
    heading("Work by room");
    for (const room of data.rooms) {
      const items = room.items || [];
      if (!room.name && !room.work && items.length === 0) continue;
      const done = items.filter((it) => it.done).length;
      ensureSpace(20);
      page.drawText(room.name || "Room", { x: MARGIN, y, size: 11, font: bold, color: INK });
      if (items.length > 0) {
        const lbl = `${done}/${items.length} complete`;
        page.drawText(lbl, { x: rightX(lbl, 9, font), y, size: 9, font, color: done === items.length ? rgb(0.13, 0.5, 0.28) : MUTED });
      }
      y -= 16;
      if (room.work) paragraph(room.work, 10, 14, MUTED);
      for (const it of items) {
        ensureSpace(14);
        page.drawText(it.done ? "[x]" : "[ ]", { x: MARGIN + 8, y, size: 10, font: bold, color: it.done ? rgb(0.13, 0.5, 0.28) : MUTED });
        page.drawText(it.label, { x: MARGIN + 30, y, size: 10, font, color: INK });
        y -= 14;
      }
      y -= 8;
    }
    y -= 2;
  }

  section("Findings", data.findings);
  section("Materials used", data.materialsUsed);
  section("Recommendations", data.recommendations);

  if (data.driveImagesLink) {
    heading("Site photos");
    ensureSpace(18);
    const label = "View site photos on Google Drive";
    const w = font.widthOfTextAtSize(label, 11);
    page.drawText(label, { x: MARGIN, y, size: 11, font, color: LINKC });
    page.drawLine({ start: { x: MARGIN, y: y - 1.5 }, end: { x: MARGIN + w, y: y - 1.5 }, thickness: 0.6, color: LINKC });
    const annot = pdf.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [MARGIN, y - 3, MARGIN + w, y + 11], Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(data.driveImagesLink) },
    });
    const ref = pdf.context.register(annot);
    const existing = page.node.Annots();
    if (existing) existing.push(ref);
    else page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
    y -= 22;
  }

  // Condition + next service — status chip.
  ensureSpace(70);
  y -= 4;
  heading("Summary");
  const ck = conditionColors(data.condition);
  const condText = data.condition || "—";
  const chipW = bold.widthOfTextAtSize(condText, 10) + 22;
  page.drawText("Overall condition", { x: MARGIN, y, size: 9, font: bold, color: MUTED });
  page.drawRectangle({ x: MARGIN + 110, y: y - 4, width: chipW, height: 18, color: ck.bg });
  page.drawText(condText, { x: MARGIN + 121, y, size: 10, font: bold, color: ck.fg });
  y -= 22;
  page.drawText("Next service due", { x: MARGIN, y, size: 9, font: bold, color: MUTED });
  page.drawText(data.nextServiceDate || "—", { x: MARGIN + 110, y, size: 10.5, font, color: INK });
  y -= 30;

  // Client sign-off.
  ensureSpace(46);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 1, color: HAIRLINE });
  y -= 22;
  page.drawText("Signed (client)", { x: MARGIN, y: y + 4, size: 8, font: bold, color: MUTED });
  page.drawText(data.signOffName || "______________________", { x: MARGIN, y: y - 12, size: 11, font, color: INK });
  page.drawText("Date", { x: width - MARGIN - 150, y: y + 4, size: 8, font: bold, color: MUTED });
  page.drawText(data.signOffDate || "______________", { x: width - MARGIN - 150, y: y - 12, size: 11, font, color: INK });

  // Footer (with page numbers) on every page, stamped after layout.
  const pages = pdf.getPages();
  const total = pages.length;
  const genDate = new Date().toLocaleDateString("en-GB");
  const footerL = `${meta.ownerName || "JoineryFlow"}${meta.ownerPhone ? " · " + meta.ownerPhone : ""}`;
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: MARGIN - 6 }, end: { x: width - MARGIN, y: MARGIN - 6 }, thickness: 0.6, color: HAIRLINE });
    p.drawText(footerL, { x: MARGIN, y: MARGIN - 20, size: 8, font, color: MUTED });
    const mid = `Generated ${genDate}`;
    p.drawText(mid, { x: (width - font.widthOfTextAtSize(mid, 8)) / 2, y: MARGIN - 20, size: 8, font, color: MUTED });
    const pn = `Page ${i + 1} of ${total}`;
    p.drawText(pn, { x: width - MARGIN - font.widthOfTextAtSize(pn, 8), y: MARGIN - 20, size: 8, font, color: MUTED });
  });

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
