import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  exportLog,
  formTemplate,
  pdfFieldMap,
  submission,
} from "./schema";
import {
  ROTEIRO_INITIAL_FIELD_MAP,
  ROTEIRO_TEMPLATE_FILE,
  ROTEIRO_TEMPLATE_NAME,
  ROTEIRO_TEMPLATE_SCHEMA,
} from "./templates/roteiro-template";

export type StoredTemplate = typeof formTemplate.$inferSelect;
export type StoredFieldMap = typeof pdfFieldMap.$inferSelect;
type FieldMapSeed = {
  fieldKey: string;
  page: number;
  x: number;
  y: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  width?: number;
  height?: number;
};

function seedToDbRow(seed: FieldMapSeed, templateId: string) {
  return {
    id: randomUUID(),
    templateId,
    fieldKey: seed.fieldKey,
    page: seed.page,
    x: seed.x,
    y: seed.y,
    fontSize: seed.fontSize ?? 11,
    fontName: "Helvetica",
    align: seed.align ?? "left",
  };
}

export async function ensureDefaultTemplateForTenant(
  tenantId: string
): Promise<StoredTemplate> {
  const existing = await db
    .select()
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.tenantId, tenantId),
        eq(formTemplate.name, ROTEIRO_TEMPLATE_NAME)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Garantir que o mapeamento PDF existe para tenants antigos.
    const existingMaps = await db
      .select()
      .from(pdfFieldMap)
      .where(eq(pdfFieldMap.templateId, existing[0].id))
      .limit(ROTEIRO_INITIAL_FIELD_MAP.length + 1);

    // Atualizar referência do PDF se estiver desatualizada.
    if (existing[0].pdfTemplateFileRef !== ROTEIRO_TEMPLATE_FILE) {
      await db
        .update(formTemplate)
        .set({
          pdfTemplateFileRef: ROTEIRO_TEMPLATE_FILE,
          updatedAt: new Date(),
        })
        .where(eq(formTemplate.id, existing[0].id));
      existing[0].pdfTemplateFileRef = ROTEIRO_TEMPLATE_FILE;
    }

    const needsReset =
      existingMaps.length !== ROTEIRO_INITIAL_FIELD_MAP.length;

    if (needsReset) {
      await db.transaction(async (tx) => {
        await tx.delete(pdfFieldMap).where(eq(pdfFieldMap.templateId, existing[0].id));
        await tx.insert(pdfFieldMap).values(
          ROTEIRO_INITIAL_FIELD_MAP.map((field) => seedToDbRow(field, existing[0].id))
        );
      });
    }

    return existing[0];
  }

  const templateId = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(formTemplate).values({
      id: templateId,
      tenantId,
      name: ROTEIRO_TEMPLATE_NAME,
      status: "published",
      schemaJson: {
        sections: ROTEIRO_TEMPLATE_SCHEMA,
        version: "roteiro-v1",
      },
      pdfTemplateFileRef: ROTEIRO_TEMPLATE_FILE,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });

    await tx.insert(pdfFieldMap).values(
      ROTEIRO_INITIAL_FIELD_MAP.map((field) => seedToDbRow(field, templateId))
    );
  });

  const [createdTemplate] = await db
    .select()
    .from(formTemplate)
    .where(eq(formTemplate.id, templateId))
    .limit(1);

  if (!createdTemplate) {
    throw new Error("Falha ao criar template padrão");
  }

  return createdTemplate;
}

export async function listTemplatesForTenant(
  tenantId: string,
  options?: { includeDrafts?: boolean }
): Promise<Array<StoredTemplate>> {
  const conditions = [eq(formTemplate.tenantId, tenantId)];

  if (!options?.includeDrafts) {
    conditions.push(eq(formTemplate.status, "published"));
  }

  const templates = await db
    .select()
    .from(formTemplate)
    .where(and(...conditions));

  return options?.includeDrafts
    ? templates
    : templates.filter((template) => template.status === "published");
}

export async function getTemplateWithMappings(
  tenantId: string,
  templateId: string
): Promise<
  | (StoredTemplate & {
      mappings: StoredFieldMap[];
    })
  | null
> {
  const [template] = await db
    .select()
    .from(formTemplate)
    .where(
      and(
        eq(formTemplate.id, templateId),
        eq(formTemplate.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!template) {
    return null;
  }

  const mappings = await db
    .select()
    .from(pdfFieldMap)
    .where(eq(pdfFieldMap.templateId, templateId));

  return { ...template, mappings };
}

export async function saveFieldMappings(
  tenantId: string,
  templateId: string,
  mappings: Array<{
    fieldKey: string;
    page: number;
    x: number;
    y: number;
    fontSize?: number | undefined;
    align?: "left" | "center" | "right" | undefined;
  }>
) {
  await db.transaction(async (tx) => {
    const template = await tx
      .select()
      .from(formTemplate)
      .where(
        and(
          eq(formTemplate.id, templateId),
          eq(formTemplate.tenantId, tenantId)
        )
      )
      .limit(1);

    if (!template[0]) {
      throw new Error("Template not found for tenant");
    }

    await tx.delete(pdfFieldMap).where(eq(pdfFieldMap.templateId, templateId));

    if (mappings.length === 0) return;

    await tx.insert(pdfFieldMap).values(
      mappings.map((map) => ({
        id: randomUUID(),
        templateId,
        fieldKey: map.fieldKey,
        page: map.page,
        x: map.x,
        y: map.y,
        fontSize: map.fontSize ?? 11,
        fontName: "Helvetica",
        align: map.align ?? "left",
      }))
    );
  });
}

export async function createSubmissionRecord(params: {
  tenantId: string;
  templateId: string;
  createdBy: string;
  dataJson: unknown;
}) {
  const submissionId = randomUUID();
  await db.insert(submission).values({
    id: submissionId,
    tenantId: params.tenantId,
    templateId: params.templateId,
    createdBy: params.createdBy,
    dataJson: params.dataJson as Record<string, unknown>,
  });

  const [created] = await db
    .select()
    .from(submission)
    .where(eq(submission.id, submissionId))
    .limit(1);

  return created;
}

export async function logExportEvent(
  tenantId: string,
  submissionId: string,
  exportedBy: string
) {
  await db.insert(exportLog).values({
    id: randomUUID(),
    tenantId,
    submissionId,
    exportedBy,
  });
}
