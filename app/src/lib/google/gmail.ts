import { google } from "googleapis";
import { getAuthorizedClient } from "./oauth";

/** Builds a raw RFC 2822 message, optionally with a single PDF attachment. */
function buildRawMessage(opts: {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachment?: { filename: string; data: Buffer; mimeType?: string };
}): string {
  const { to, from, subject, body, attachment } = opts;
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`;

  let mime: string;
  if (attachment) {
    const boundary = "joineryflow_boundary_000";
    mime =
      `From: ${from}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${encodedSubject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
      `${body}\r\n\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${attachment.mimeType || "application/pdf"}; name="${attachment.filename}"\r\n` +
      `Content-Disposition: attachment; filename="${attachment.filename}"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${attachment.data.toString("base64")}\r\n` +
      `--${boundary}--`;
  } else {
    mime =
      `From: ${from}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${encodedSubject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
      body;
  }

  return Buffer.from(mime)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Sends an email as the connected Google account. Returns true if sent. */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  attachment?: { filename: string; data: Buffer; mimeType?: string };
}): Promise<boolean> {
  const auth = await getAuthorizedClient();
  if (!auth) return false;

  const gmail = google.gmail({ version: "v1", auth });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const from = profile.data.emailAddress || "me";

  const raw = buildRawMessage({ ...opts, from });
  await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
  return true;
}

export type FoundAttachment = {
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
};

/**
 * Searches the mailbox for PDF attachments relevant to a job (by reference,
 * client email, or title) and downloads them. Returns [] in demo mode.
 */
export async function findJobPdfAttachments(query: {
  reference: string;
  clientEmail?: string | null;
  title: string;
  maxMessages?: number;
}): Promise<FoundAttachment[]> {
  const auth = await getAuthorizedClient();
  if (!auth) return [];

  const gmail = google.gmail({ version: "v1", auth });
  const terms: string[] = ['filename:pdf', 'has:attachment'];
  const orTerms = [`"${query.reference}"`, `"${query.title}"`];
  if (query.clientEmail) orTerms.push(`from:${query.clientEmail}`);
  const q = `${terms.join(" ")} (${orTerms.join(" OR ")})`;

  const list = await gmail.users.messages.list({
    userId: "me",
    q,
    maxResults: query.maxMessages || 10,
  });

  const results: FoundAttachment[] = [];
  for (const msg of list.data.messages || []) {
    const full = await gmail.users.messages.get({ userId: "me", id: msg.id!, format: "full" });
    const parts = flattenParts(full.data.payload);
    for (const part of parts) {
      if (
        part.filename &&
        part.filename.toLowerCase().endsWith(".pdf") &&
        part.body?.attachmentId
      ) {
        const att = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: msg.id!,
          id: part.body.attachmentId,
        });
        const dataB64 = att.data.data || "";
        results.push({
          messageId: msg.id!,
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || "application/pdf",
          data: Buffer.from(dataB64, "base64"),
        });
      }
    }
  }
  return results;
}

function flattenParts(payload: any): any[] {
  if (!payload) return [];
  const out: any[] = [];
  const walk = (p: any) => {
    if (!p) return;
    out.push(p);
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  return out;
}
