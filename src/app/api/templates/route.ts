import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  ensureDefaultTemplateForTenant,
  listTemplatesForTenant,
} from "@/lib/form-service";
import { requireOrgAccess } from "@/lib/org-guard";
import { hasPermission } from "@/lib/rbac";
import { formTemplate } from "@/lib/schema";

const createTemplateSchema = z.object({
  name: z.string().min(2).max(120),
  schemaJson: z.record(z.string(), z.any()),
  pdfTemplateFileRef: z.string().min(2),
});

export async function GET(req: NextRequest) {
  const access = await requireOrgAccess(req);
  if (access instanceof NextResponse) {
    return access;
  }

  await ensureDefaultTemplateForTenant(access.orgId);
  const includeDrafts = req.nextUrl.searchParams.get("includeDrafts") === "1";

  if (includeDrafts) {
    const canViewDrafts = await hasPermission(
      access.session.user.id,
      access.orgId,
      "form:edit"
    );

    if (!canViewDrafts) {
      return NextResponse.json(
        { error: "Permissão negada" },
        { status: 403 }
      );
    }
  }

  const templates = await listTemplatesForTenant(access.orgId, {
    includeDrafts,
  });

  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const access = await requireOrgAccess(req, "ADMIN");
  if (access instanceof NextResponse) {
    return access;
  }

  const allowed = await hasPermission(
    access.session.user.id,
    access.orgId,
    "form:create"
  );

  if (!allowed) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createTemplateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const templateId = randomUUID();
  const now = new Date();

  const [created] = await db
    .insert(formTemplate)
    .values({
      id: templateId,
      tenantId: access.orgId,
      name: parsed.data.name,
      status: "draft",
      schemaJson: parsed.data.schemaJson,
      pdfTemplateFileRef: parsed.data.pdfTemplateFileRef,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return NextResponse.json({ template: created }, { status: 201 });
}
