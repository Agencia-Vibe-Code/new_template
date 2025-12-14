import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSubmissionRecord } from "@/lib/form-service";
import { requireOrgAccess } from "@/lib/org-guard";
import { hasPermission } from "@/lib/rbac";
import { formTemplate, submission } from "@/lib/schema";
import { orderSubmissionsLatestFirst } from "@/lib/submission-utils";

const submissionSchema = z.object({
  templateId: z.string().uuid(),
  data: z.record(z.string(), z.any()),
});

export async function GET(req: NextRequest) {
  const access = await requireOrgAccess(req);
  if (access instanceof NextResponse) return access;

  const canView = await hasPermission(
    access.session.user.id,
    access.orgId,
    "submission:view"
  );

  if (!canView) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }

  const items = await db
    .select({
      id: submission.id,
      templateId: submission.templateId,
      createdAt: submission.createdAt,
      createdBy: submission.createdBy,
    })
    .from(submission)
    .where(eq(submission.tenantId, access.orgId))
    .orderBy(desc(submission.createdAt));

  return NextResponse.json({
    submissions: orderSubmissionsLatestFirst(items),
  });
}

export async function POST(req: NextRequest) {
  const access = await requireOrgAccess(req);
  if (access instanceof NextResponse) return access;

  const allowed = await hasPermission(
    access.session.user.id,
    access.orgId,
    "submission:create"
  );

  if (!allowed) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const template = await db
    .select()
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.id, parsed.data.templateId),
        eq(formTemplate.tenantId, access.orgId)
      )
    )
    .limit(1);

  if (!template[0]) {
    return NextResponse.json(
      { error: "Template não encontrado para este tenant" },
      { status: 404 }
    );
  }

  const created = await createSubmissionRecord({
    tenantId: access.orgId,
    templateId: parsed.data.templateId,
    createdBy: access.session.user.id,
    dataJson: parsed.data.data,
  });

  return NextResponse.json({ submission: created }, { status: 201 });
}
