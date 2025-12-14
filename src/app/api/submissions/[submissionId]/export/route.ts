import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { logExportEvent } from "@/lib/form-service";
import { requireOrgAccess } from "@/lib/org-guard";
import { renderPdfFromSubmission } from "@/lib/pdf/export";
import { hasPermission } from "@/lib/rbac";
import {
  formTemplate,
  pdfFieldMap,
  submission as submissionTable,
} from "@/lib/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await params;
  const access = await requireOrgAccess(req);
  if (access instanceof NextResponse) return access;

  const allowed = await hasPermission(
    access.session.user.id,
    access.orgId,
    "submission:export"
  );

  if (!allowed) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }

  const [submission] = await db
    .select()
    .from(submissionTable)
    .where(
      and(
        eq(submissionTable.id, submissionId),
        eq(submissionTable.tenantId, access.orgId)
      )
    )
    .limit(1);

  if (!submission) {
    return NextResponse.json({ error: "Submissão não encontrada" }, { status: 404 });
  }

  const [template] = await db
    .select()
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.id, submission.templateId),
        eq(formTemplate.tenantId, access.orgId)
      )
    )
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  const mappings = await db
    .select()
    .from(pdfFieldMap)
    .where(eq(pdfFieldMap.templateId, template.id));

  const pdfBytes = await renderPdfFromSubmission({
    template,
    mappings,
    data: submission.dataJson as Record<string, unknown>,
  });

  await logExportEvent(access.orgId, submission.id, access.session.user.id);

  const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfArrayBuffer).set(pdfBytes);
  const pdfBlob = new Blob([pdfArrayBuffer], { type: "application/pdf" });

  return new NextResponse(pdfBlob, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="submission-${submission.id}.pdf"`,
    },
  });
}
