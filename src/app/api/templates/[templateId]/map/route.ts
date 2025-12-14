import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { saveFieldMappings } from "@/lib/form-service";
import { requireOrgAccess } from "@/lib/org-guard";
import { hasPermission } from "@/lib/rbac";

const mappingSchema = z.object({
  mappings: z
    .array(
      z.object({
        fieldKey: z.string().min(1),
        page: z.number().int().positive(),
        x: z.number(),
        y: z.number(),
        fontSize: z.number().optional(),
        align: z.enum(["left", "center", "right"]).optional(),
      })
    )
    .nonempty(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;
  const access = await requireOrgAccess(req, "MANAGER");
  if (access instanceof NextResponse) {
    return access;
  }

  const permitted = await hasPermission(
    access.session.user.id,
    access.orgId,
    "form:map"
  );

  if (!permitted) {
    return NextResponse.json({ error: "Permissão negada" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = mappingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Entrada inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await saveFieldMappings(
    access.orgId,
    templateId,
    parsed.data.mappings
  );

  return NextResponse.json({ ok: true });
}
