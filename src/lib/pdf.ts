// Client-only PDF / text extraction utilities.
import * as pdfjsLib from "pdfjs-dist";
// Vite resolves this to a hashed URL for the worker bundle.
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractText(file: File): Promise<string> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    // Plain text / markdown / etc.
    return (await file.text()).trim();
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const parts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(pageText);
  }

  const text = parts.join("\n\n").replace(/\s+\n/g, "\n").trim();
  if (!text) {
    throw new Error(
      "No selectable text found. This PDF may be scanned/image-only.",
    );
  }
  return text;
}
