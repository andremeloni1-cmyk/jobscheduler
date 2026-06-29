import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { isGoogleConnected } from "@/lib/google/oauth";
import { uploadPhotosToJobFolder } from "@/lib/google/drive";
import { logActivity } from "@/lib/automations";

export const dynamic = "force-dynamic";

// The client uploads in small chunks, but accept a generous per-request count
// so a manual/bulk post still works without silently dropping photos.
const MAX_FILES = 50;

// Upload site photos straight from the dashboard into the job's shared
// "Photos (client)" Drive folder, and record them as documents. Returns the
// shareable folder link so the UI can offer it to the client.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const job = await prisma.job.findUnique({ where: { id: (await params).id } });
  if (!job) return json({ error: "not found" }, 404);

  if (!(await isGoogleConnected())) {
    return json({ ok: false, connected: false, saved: 0, message: "Connect Google in Settings to upload photos to Drive." });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "invalid upload" }, 400);

  const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
  const images: { name: string; data: Buffer; mimeType: string }[] = [];
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    images.push({
      name: f.name || `photo-${images.length + 1}.jpg`,
      data: Buffer.from(await f.arrayBuffer()),
      mimeType: f.type,
    });
  }
  if (images.length === 0) {
    return json({ ok: false, saved: 0, message: "No image files found in the upload." });
  }

  const res = await uploadPhotosToJobFolder(job, images);
  if (!res) return json({ ok: false, connected: false, saved: 0, message: "Couldn't reach Google Drive just now." });

  for (const u of res.uploaded) {
    await prisma.document.create({
      data: {
        jobId: job.id,
        name: u.name,
        driveFileId: u.fileId,
        webViewLink: u.webViewLink,
        source: "upload",
        mimeType: u.mimeType,
      },
    });
  }
  await logActivity(job.id, "drive", `Uploaded ${res.uploaded.length} photo(s) to the client photos folder`);

  return json({ ok: true, connected: true, saved: res.uploaded.length, folderLink: res.folderLink });
}
