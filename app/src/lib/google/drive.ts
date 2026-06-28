import { google } from "googleapis";
import { Readable } from "node:stream";
import { getAuthorizedClient } from "./oauth";
import { prisma } from "@/lib/db";

const ROOT_FOLDER_NAME = "JoineryFlow Jobs";

/** Finds (or creates) the root Drive folder where all job folders live. */
async function ensureRootFolder(auth: any): Promise<string> {
  const account = await prisma.account.findFirst();
  if (account?.driveFolderId) return account.driveFolderId;

  const drive = google.drive({ version: "v3", auth });
  const found = await drive.files.list({
    q: `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  let id = found.data.files?.[0]?.id;
  if (!id) {
    const created = await drive.files.create({
      requestBody: {
        name: ROOT_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    id = created.data.id!;
  }
  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { driveFolderId: id } });
  }
  return id!;
}

/** Finds (or creates) the Drive folder for a single job. Returns its id. */
export async function ensureJobFolder(job: {
  id: string;
  reference: string;
  title: string;
  driveFolderId?: string | null;
}): Promise<string | null> {
  const auth = await getAuthorizedClient();
  if (!auth) return null;
  if (job.driveFolderId) return job.driveFolderId;

  const drive = google.drive({ version: "v3", auth });
  const root = await ensureRootFolder(auth);
  const name = `${job.reference} — ${job.title}`.slice(0, 120);

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [root],
    },
    fields: "id",
  });
  const folderId = created.data.id!;
  await prisma.job.update({ where: { id: job.id }, data: { driveFolderId: folderId } });
  return folderId;
}

export type UploadedFile = {
  fileId: string;
  name: string;
  webViewLink: string;
  mimeType: string;
};

/** Uploads a buffer into a job's Drive folder and returns shareable metadata. */
export async function uploadToJobFolder(
  job: { id: string; reference: string; title: string; driveFolderId?: string | null },
  name: string,
  data: Buffer,
  mimeType = "application/pdf"
): Promise<UploadedFile | null> {
  const auth = await getAuthorizedClient();
  if (!auth) return null;

  const folderId = await ensureJobFolder(job);
  const drive = google.drive({ version: "v3", auth });

  // Dedupe: if a file with this name already exists in the job's folder, update
  // it in place instead of adding another copy. This stops the folder filling up
  // with duplicates when plans are re-attached or a report is regenerated.
  if (folderId) {
    const escaped = name.replace(/'/g, "\\'");
    const found = await drive.files
      .list({
        q: `name='${escaped}' and '${folderId}' in parents and trashed=false`,
        fields: "files(id, name, webViewLink, mimeType)",
        spaces: "drive",
      })
      .catch(() => null);
    const existing = found?.data.files?.[0];
    if (existing?.id) {
      const updated = await drive.files.update({
        fileId: existing.id,
        media: { mimeType, body: Readable.from(data) },
        fields: "id, name, webViewLink, mimeType",
      });
      return {
        fileId: updated.data.id || existing.id,
        name: updated.data.name || existing.name || name,
        webViewLink:
          updated.data.webViewLink || existing.webViewLink || `https://drive.google.com/file/d/${existing.id}/view`,
        mimeType: updated.data.mimeType || mimeType,
      };
    }
  }

  const created = await drive.files.create({
    requestBody: { name, parents: folderId ? [folderId] : undefined },
    media: { mimeType, body: Readable.from(data) },
    fields: "id, name, webViewLink, mimeType",
  });

  // Files stay private to the connected Google account. The webViewLink on the
  // calendar event opens for the owner (who is signed in) without making
  // confidential client drawings / POs / addresses public to anyone with the link.

  return {
    fileId: created.data.id!,
    name: created.data.name || name,
    webViewLink:
      created.data.webViewLink || `https://drive.google.com/file/d/${created.data.id}/view`,
    mimeType: created.data.mimeType || mimeType,
  };
}
