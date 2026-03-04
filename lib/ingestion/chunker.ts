import { encoding_for_model } from "tiktoken";

export interface ChunkMetadata {
  documentId?: string;
  chunkIndex: number;
  pageNumber?: number;
  heading?: string;
  documentTitle?: string;
}

export interface TextChunk {
  content: string;
  tokenCount: number;
  metadata: ChunkMetadata;
}

const TARGET_MAX_TOKENS = 800;
const OVERLAP_TOKENS = 100;

const SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " "];

function splitBySeparator(text: string, separator: string): string[] {
  const parts = text.split(separator);
  return parts
    .map((part, i) => (i < parts.length - 1 ? part + separator : part))
    .filter((p) => p.length > 0);
}

function recursiveSplit(text: string, separatorIndex: number): string[] {
  if (separatorIndex >= SEPARATORS.length) {
    return [text];
  }

  const separator = SEPARATORS[separatorIndex];
  const parts = splitBySeparator(text, separator);

  if (parts.length <= 1) {
    return recursiveSplit(text, separatorIndex + 1);
  }

  return parts;
}

export function chunkText(
  text: string,
  options?: {
    documentTitle?: string;
    pageNumber?: number;
    heading?: string;
  }
): TextChunk[] {
  const enc = encoding_for_model("gpt-4o");
  const chunks: TextChunk[] = [];

  const segments = recursiveSplit(text.trim(), 0);

  let currentChunk = "";
  let currentTokens = 0;
  let chunkIndex = 0;

  for (const segment of segments) {
    const segmentTokens = enc.encode(segment).length;

    if (currentTokens + segmentTokens > TARGET_MAX_TOKENS && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        tokenCount: currentTokens,
        metadata: {
          chunkIndex,
          pageNumber: options?.pageNumber,
          heading: options?.heading,
          documentTitle: options?.documentTitle,
        },
      });
      chunkIndex++;

      const overlapText = getOverlapText(currentChunk, enc);
      currentChunk = overlapText + segment;
      currentTokens = enc.encode(currentChunk).length;
    } else {
      currentChunk += segment;
      currentTokens += segmentTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      tokenCount: enc.encode(currentChunk.trim()).length,
      metadata: {
        chunkIndex,
        pageNumber: options?.pageNumber,
        heading: options?.heading,
        documentTitle: options?.documentTitle,
      },
    });
  }

  enc.free();
  return chunks;
}

function getOverlapText(
  text: string,
  enc: ReturnType<typeof encoding_for_model>
): string {
  const tokens = enc.encode(text);
  if (tokens.length <= OVERLAP_TOKENS) return text;
  const overlapTokens = tokens.slice(-OVERLAP_TOKENS);
  return new TextDecoder().decode(enc.decode(overlapTokens));
}

export function chunkDocument(
  pages: { text: string; pageNumber?: number; heading?: string }[],
  documentTitle: string
): TextChunk[] {
  const allChunks: TextChunk[] = [];
  let globalIndex = 0;

  for (const page of pages) {
    const pageChunks = chunkText(page.text, {
      documentTitle,
      pageNumber: page.pageNumber,
      heading: page.heading,
    });

    for (const chunk of pageChunks) {
      chunk.metadata.chunkIndex = globalIndex++;
      allChunks.push(chunk);
    }
  }

  return allChunks;
}
