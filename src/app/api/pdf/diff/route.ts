import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAccess } from "@/lib/org-guard";
import { diffPdfAgainstTemplate } from "@/lib/pdf/diff";
import { ROTEIRO_TEMPLATE_FILE } from "@/lib/templates/roteiro-template";

const payloadSchema = z.object({
  templateRef: z.string().optional(),
  candidateBase64: z.string(),
});

type DiffInput =
  | { templateRef: string; bytes: Uint8Array }
  | { response: NextResponse };

export async function extractDiffInput(
  req: NextRequest
): Promise<DiffInput> {
  const contentType = req.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  if (isMultipart) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      const templateRef = form.get("templateRef");

      if (!(file instanceof Blob)) {
        return {
          response: NextResponse.json(
            { error: "Arquivo PDF obrigatório" },
            { status: 400 }
          ),
        };
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const templateRefValue =
        typeof templateRef === "string" && templateRef.length > 0
          ? templateRef
          : ROTEIRO_TEMPLATE_FILE;

      return {
        templateRef: templateRefValue,
        bytes,
      };
    } catch (error) {
      return {
        response: NextResponse.json(
          {
            error: "Falha ao processar upload do PDF.",
            details: `${error}`,
          },
          { status: 400 }
        ),
      };
    }
  }

  const body = await req.json();
  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return {
      response: NextResponse.json(
        { error: "Entrada inválida", details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }

  return {
    templateRef: parsed.data.templateRef ?? ROTEIRO_TEMPLATE_FILE,
    bytes: Buffer.from(parsed.data.candidateBase64, "base64"),
  };
}

export async function POST(req: NextRequest) {
  const access = await requireOrgAccess(req, "MANAGER");
  if (access instanceof NextResponse) return access;

  const diffInput = await extractDiffInput(req);
  if ("response" in diffInput) {
    return diffInput.response;
  }

  try {
    const result = await diffPdfAgainstTemplate(
      diffInput.templateRef,
      diffInput.bytes
    );

    return NextResponse.json({ diff: result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Falha ao gerar diff. Instale as dependências opcionais (canvas, pdfjs-dist, pixelmatch, pngjs).",
        details: `${error}`,
      },
      { status: 500 }
    );
  }
}
