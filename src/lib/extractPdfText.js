/**
 * Client-side PDF text extraction using pdfjs-dist. Lazy-loaded so the main
 * bundle doesn't pay the cost when the Generate page isn't visited.
 */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

export async function extractPdfText(file, { pageRange } = {}) {
  if (!file) throw new Error("No file provided");
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const totalPages = pdf.numPages;
  const start = Math.max(1, pageRange?.start || 1);
  const end = Math.min(totalPages, pageRange?.end || totalPages);

  const pageTexts = [];
  for (let p = start; p <= end; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pageTexts.push(text);
  }

  const full = pageTexts.join("\n\n");
  return {
    text: full,
    totalPages,
    extractedPages: end - start + 1,
    wordCount: full.split(/\s+/).filter(Boolean).length,
    preview: full.slice(0, 500),
  };
}
