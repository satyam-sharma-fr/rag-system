export interface ParsedPage {
  text: string;
  pageNumber: number;
}

export async function parsePdf(
  buffer: Buffer
): Promise<{ title: string; pages: ParsedPage[] }> {
  // Dynamic import to avoid loading pdf-parse when not needed
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);

  // pdf-parse v1 returns all text as one string; split by form feeds for pages
  const pageTexts = data.text.split("\f").filter((t: string) => t.trim().length > 0);

  const pages: ParsedPage[] =
    pageTexts.length > 0
      ? pageTexts.map((text: string, i: number) => ({
          text: text.trim(),
          pageNumber: i + 1,
        }))
      : data.text.trim()
        ? [{ text: data.text.trim(), pageNumber: 1 }]
        : [];

  const title =
    data.info?.Title || `PDF Document (${data.numpages} pages)`;

  return { title, pages };
}
