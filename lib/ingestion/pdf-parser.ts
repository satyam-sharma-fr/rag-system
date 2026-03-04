import { PDFParse } from "pdf-parse";

export interface ParsedPage {
  text: string;
  pageNumber: number;
}

export async function parsePdf(
  buffer: Buffer
): Promise<{ title: string; pages: ParsedPage[] }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  const textResult = await parser.getText();
  const infoResult = await parser.getInfo();

  const pages: ParsedPage[] = textResult.pages.map((page) => ({
    text: page.text.trim(),
    pageNumber: page.num,
  }));

  const filteredPages = pages.filter((p) => p.text.length > 0);

  if (filteredPages.length === 0 && textResult.text.trim()) {
    filteredPages.push({ text: textResult.text.trim(), pageNumber: 1 });
  }

  const title =
    infoResult.info?.Title || `PDF Document (${textResult.total} pages)`;

  await parser.destroy();

  return { title, pages: filteredPages };
}
