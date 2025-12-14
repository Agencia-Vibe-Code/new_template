import { promises as fs } from "fs";
import path from "path";

type DiffResult = {
  width: number;
  height: number;
  diffPixels: number;
  diffRatio: number;
};

/**
 * Renders both PDFs to PNG buffers and returns pixelmatch diff data.
 * Requires optional peer deps: pdfjs-dist, canvas/@napi-rs/canvas, pngjs, pixelmatch.
 */
export async function diffPdfAgainstTemplate(
  templatePath: string,
  candidateBytes: Uint8Array
): Promise<DiffResult> {
  const [{ createCanvas }, pdfjs, { PNG }, { default: pixelmatch }] =
    await Promise.all([
      import("canvas"),
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pngjs"),
      import("pixelmatch"),
    ]);

  const renderToImage = async (bytes: Uint8Array) => {
    const pdf = await pdfjs.getDocument({ data: bytes }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d") as any;
    await page.render({ canvasContext: context, viewport }).promise;
    const buffer = canvas.toBuffer("image/png");
    const png = PNG.sync.read(buffer);
    return png;
  };

  const resolvedTemplatePath = templatePath.startsWith("/")
    ? path.join(process.cwd(), "public", templatePath)
    : templatePath;

  const [templatePng, candidatePng] = await Promise.all([
    renderToImage(await fs.readFile(resolvedTemplatePath)),
    renderToImage(candidateBytes),
  ]);

  const width = Math.min(templatePng.width, candidatePng.width);
  const height = Math.min(templatePng.height, candidatePng.height);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(
    templatePng.data,
    candidatePng.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  );

  return {
    width,
    height,
    diffPixels,
    diffRatio: diffPixels / (width * height),
  };
}
