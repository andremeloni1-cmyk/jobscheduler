import { prisma } from "@/lib/db";
import { json } from "@/lib/utils";
import { isAuthenticated } from "@/lib/session";
import { generateReportPdf, type ReportData } from "@/lib/pdf";
import { uploadToJobFolder, ensureJobPhotosFolder } from "@/lib/google/drive";
import { sendEmail } from "@/lib/google/gmail";
import { resolveTemplate, jobTemplateVars } from "@/lib/email-templates";
import { logActivity } from "@/lib/automations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Create or update a maintenance report draft.
export async function POST(req: Request, { params }: Params) {
  if (!(await isAuthenticated())) return json({ error: "unauthorized" }, 401);
  const job = await prisma.job.findUnique({ where: { id: (await params).id } });
  if (!job) return json({ error: "not found" }, 404);

  const body = await req.json().catch(() => ({}));
  const data: ReportData = body.data || {};
  const reportId: string | undefined = body.reportId;

  let report;
  if (reportId) {
    report = await prisma.maintenanceReport.update({
      where: { id: reportId },
      data: { data: JSON.stringify(data) },
    });
  } else {
    report = await prisma.maintenanceReport.create({
      data: { jobId: job.id, data: JSON.stringify(data) },
    });
  }

  // Action: generate the PDF and (optionally) email it to the client.
  if (body.action === "generate" || body.action === "send") {
    const account = await prisma.account.findFirst();
    const pdf = await generateReportPdf(
      {
        jobTitle: job.title,
        reference: job.reference,
        clientName: job.clientName,
        address: job.address,
        ownerName: account?.name,
      },
      data
    );
    const filename = `Maintenance-Report-${job.reference}.pdf`;

    // Save a copy to the job's Drive folder (no-op in demo mode).
    const uploaded = await uploadToJobFolder(job, filename, pdf, "application/pdf");
    if (uploaded) {
      await prisma.maintenanceReport.update({
        where: { id: report.id },
        data: { driveFileId: uploaded.fileId, webViewLink: uploaded.webViewLink },
      });
      // Reuse the existing document row for this report file (regenerating a
      // report updates the same file rather than adding another).
      const existingDoc = await prisma.document.findFirst({ where: { jobId: job.id, name: filename } });
      if (existingDoc) {
        await prisma.document.update({
          where: { id: existingDoc.id },
          data: { driveFileId: uploaded.fileId, webViewLink: uploaded.webViewLink },
        });
      } else {
        await prisma.document.create({
          data: {
            jobId: job.id,
            name: filename,
            driveFileId: uploaded.fileId,
            webViewLink: uploaded.webViewLink,
            source: "report",
          },
        });
      }
      await logActivity(job.id, "report", "Saved maintenance report to Google Drive");
    }

    if (body.action === "send" && job.clientEmail) {
      const tpl = await resolveTemplate(
        job,
        "report",
        jobTemplateVars(job, account?.name || "The Workshop")
      );
      // Add a clickable "View site photos" button to the email. When the report
      // links the job's own photos folder, make sure it's shared so the client
      // can actually open it.
      const links: { label: string; url: string }[] = [];
      if (data.driveImagesLink) {
        await ensureJobPhotosFolder(job).catch(() => {});
        links.push({ label: "📷 View site photos", url: data.driveImagesLink });
      }
      const sent = await sendEmail({
        to: job.clientEmail,
        subject: tpl?.subject || `Maintenance report — ${job.reference}`,
        body: tpl?.body || "Please find your maintenance report attached.",
        attachment: { filename, data: pdf, mimeType: "application/pdf" },
        links,
      });
      await prisma.maintenanceReport.update({
        where: { id: report.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await logActivity(
        job.id,
        "report",
        sent
          ? `Emailed maintenance report to ${job.clientEmail}`
          : `Report ready (demo mode — connect Google to email it)`
      );
    }

    // Return the PDF bytes so the UI can offer an immediate download.
    return json({
      report: await prisma.maintenanceReport.findUnique({ where: { id: report.id } }),
      pdfBase64: pdf.toString("base64"),
      filename,
    });
  }

  return json({ report });
}
