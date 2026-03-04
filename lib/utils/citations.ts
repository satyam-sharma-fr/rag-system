import type { SearchResult } from "./hybrid-search";

export interface Citation {
  sourceIndex: number;
  chunkId: string;
  documentTitle: string;
  pageNumber?: number;
  heading?: string;
  content: string;
}

export function buildCitationMap(
  chunks: SearchResult[]
): Map<number, Citation> {
  const map = new Map<number, Citation>();
  chunks.forEach((chunk, index) => {
    const sourceIndex = index + 1; // 1-based for [Source 1], [Source 2], etc.
    map.set(sourceIndex, {
      sourceIndex,
      chunkId: chunk.id,
      documentTitle: chunk.documentTitle,
      pageNumber: chunk.pageNumber,
      heading: chunk.heading,
      content: chunk.content,
    });
  });
  return map;
}

export function extractCitations(text: string): number[] {
  const regex = /\[Source\s+(\d+)\]/g;
  const citations: number[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    citations.push(parseInt(match[1], 10));
  }
  return [...new Set(citations)];
}

export function validateCitations(
  text: string,
  availableSources: number
): { valid: number[]; invalid: number[] } {
  const cited = extractCitations(text);
  const valid = cited.filter((n) => n >= 1 && n <= availableSources);
  const invalid = cited.filter((n) => n < 1 || n > availableSources);
  return { valid, invalid };
}

export function formatChunksForContext(chunks: SearchResult[]): string {
  return chunks
    .map((chunk, i) => {
      const sourceLabel = `[Source ${i + 1}]`;
      const meta = [
        chunk.documentTitle && `Document: ${chunk.documentTitle}`,
        chunk.pageNumber && `Page: ${chunk.pageNumber}`,
        chunk.heading && `Section: ${chunk.heading}`,
      ]
        .filter(Boolean)
        .join(" | ");

      return `${sourceLabel} ${meta}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
