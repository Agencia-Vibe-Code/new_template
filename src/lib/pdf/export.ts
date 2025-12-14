import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { StoredFieldMap, StoredTemplate } from "../form-service";
import {
  ROTEIRO_INITIAL_FIELD_MAP,
  ROTEIRO_TEMPLATE_NAME,
} from "../templates/roteiro-template";

type RenderParams = {
  template: StoredTemplate;
  mappings: StoredFieldMap[];
  data: Record<string, unknown>;
};

function formatValue(value: unknown): string {
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("pt-BR").format(value);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return value ? String(value) : "";
}

export async function renderPdfFromSubmission({
  template,
  mappings,
  data,
}: RenderParams): Promise<Uint8Array> {
  const pdfPath =
    template.pdfTemplateFileRef.startsWith("/")
      ? path.join(process.cwd(), "public", template.pdfTemplateFileRef)
      : template.pdfTemplateFileRef;

  const pdfBytes = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const effectiveMappings: Array<
    StoredFieldMap & { width?: number; height?: number }
  > =
    mappings.length > 0
      ? mappings
      : template.name === ROTEIRO_TEMPLATE_NAME
        ? ROTEIRO_INITIAL_FIELD_MAP.map((m) => ({
            ...m,
            id: `${m.fieldKey}-fallback`,
            templateId: template.id,
            fontName: "Helvetica",
            align: (m as any).align ?? "left",
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        : [];

  effectiveMappings.forEach((map) => {
    const value = formatValue(data[map.fieldKey]);
    if (!value) return;
    const pageIndex = Math.max(0, Math.min(map.page - 1, pages.length - 1));
    const page = pages[pageIndex];
    if (!page) return;

    // Apaga o texto do template original na área do campo.
    const fontSize = map.fontSize ?? 11;
    const rectHeight =
      (map as any).height ??
      Math.max(fontSize + 4, fontSize * 1.3);
    const rectWidth = (map as any).width ?? 200;
    const rectY = map.y - rectHeight * 0.25;
    page.drawRectangle({
      x: map.x,
      y: rectY,
      width: rectWidth,
      height: rectHeight,
      color: rgb(1, 1, 1),
    });

    page.drawText(value, {
      x: map.x,
      y: map.y,
      size: map.fontSize ?? 11,
      font,
      color: rgb(0, 0, 0),
    });
  });

  return pdfDoc.save();
}
