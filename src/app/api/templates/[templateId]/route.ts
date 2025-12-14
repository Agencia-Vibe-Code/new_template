import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getTemplateWithMappings,
} from "@/lib/form-service";
import { requireOrgAccess } from "@/lib/org-guard";
import { hasPermission } from "@/lib/rbac";
import { formTemplate } from "@/lib/schema";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  schemaJson: z.record(z.string(), z.any()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const access = await requireOrgAccess(req);
  if (access instanceof NextResponse) return access;

  const template = await getTemplateWithMappings(
    access.orgId,
    templateId
  );

  if (!template) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ template });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const access = await requireOrgAccess(req, "ADMIN");
  if (access instanceof NextResponse) return access;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  if (payload.status === "published") {
    const canPublish = await hasPermission(
      access.session.user.id,
      access.orgId,
      "form:publish"
    );
    if (!canPublish) {
      return NextResponse.json(
        { error: "Permissão negada" },
        { status: 403 }
      );
    }
  } else {
    const canEdit = await hasPermission(
      access.session.user.id,
      access.orgId,
      "form:edit"
    );
    if (!canEdit) {
      return NextResponse.json(
        { error: "Permissão negada" },
        { status: 403 }
      );
    }
  }

  const [updated] = await db
    .update(formTemplate)
    .set({
      ...payload,
      updatedAt: new Date(),
      publishedAt:
        payload.status === "published" ? new Date() : undefined,
    })
    .where(
      and(
        eq(formTemplate.id, templateId),
        eq(formTemplate.tenantId, access.orgId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ template: updated });
}
