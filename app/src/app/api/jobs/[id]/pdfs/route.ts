import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { isGoogleConnected } from "@/lib/google/oauth";
import { uploadToJobFolder } from "@/lib/google/drive";
import { logActivity } from "@/lib/automations";

export const dynamic = "force-dynamic";

const MAX_FILES = 20;
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

// Upload PDFs (plans, POs, quotes) straight from the app into the job's private
// Drive folder and record them as documents. Mirrors the photo upload, but PDFs
// stay private to the owner (uploadToJobFolder, not the shared photos folder).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const job = await prisma.job.findUnique({ where: { id: (await params).id } });
  if (!job) return json({ error: "not found" }, 404);

  if (!(await isGoogleConnected())) {
    return json({ ok: false, connected: false, saved: 0, message: "Connect Google in Settings to upload PDFs to Drive." });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "invalid upload" }, 400);

  const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  const pdfs = files.filter(isPdf);
  if (pdfs.length === 0) {
    return json({ ok: false, saved: 0, message: "No PDF files found in the upload." });
  }

  let saved = 0;
  for (const f of pdfs) {
    const name = f.name || `document-${saved + 1}.pdf`;
    const data = Buffer.from(await f.arrayBuffer());
    const up = await uploadToJobFolder(job, name, data, "application/pdf");
    if (!up) return json({ ok: false, connected: false, saved, message: "Couldn't reach Google Drive just now." });

    // Dedupe the document record by filename so re-uploading a plan updates the
    // existing row (Drive already dedupes the file itself) rather than adding a copy.
    const existing = await prisma.document.findFirst({ where: { jobId: job.id, name: up.name } });
    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: { driveFileId: up.fileId, webViewLink: up.webViewLink, source: "upload", mimeType: up.mimeType },
      });
    } else {
      await prisma.document.create({
        data: {
          jobId: job.id,
          name: up.name,
          driveFileId: up.fileId,
          webViewLink: up.webViewLink,
          source: "upload",
          mimeType: up.mimeType,
        },
      });
    }
    saved++;
  }

  await logActivity(job.id, "drive", `Uploaded ${saved} PDF${saved === 1 ? "" : "s"} to the job folder`);
  return json({ ok: true, connected: true, saved });
}
