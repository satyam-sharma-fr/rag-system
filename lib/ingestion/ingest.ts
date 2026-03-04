import { createHash } from "crypto";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema/documents";
import { chunks } from "@/lib/db/schema/chunks";
import { embedMany } from "@/lib/ai/embedding";
import { chunkDocument, chunkText, TextChunk } from "./chunker";
import { parseMarkdown } from "./markdown-parser";
import { parseWebPage } from "./web-parser";

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function ingestPdf(buffer: Buffer, fileName: string) {
  // Dynamic import to avoid loading pdf-parse at module level (DOMMatrix issue on Vercel)
  const { parsePdf } = await import("./pdf-parser");
  const { title, pages } = await parsePdf(buffer);
  const allText = pages.map((p) => p.text).join("\n");
  const hash = contentHash(allText);

  const textChunks = chunkDocument(
    pages.map((p) => ({ text: p.text, pageNumber: p.pageNumber })),
    title
  );

  return saveDocument({
    title: fileName || title,
    sourceType: "pdf",
    contentHash: hash,
    chunks: textChunks,
  });
}

export async function ingestMarkdown(
  content: string,
  title?: string,
  sourceUrl?: string
) {
  const { title: docTitle, sections } = await parseMarkdown(content, title);
  const hash = contentHash(content);

  const textChunks = chunkDocument(
    sections.map((s) => ({ text: s.text, heading: s.heading })),
    docTitle
  );

  return saveDocument({
    title: docTitle,
    sourceType: "md",
    sourceUrl,
    contentHash: hash,
    chunks: textChunks,
  });
}

export async function ingestWebPage(url: string) {
  const { title, text } = await parseWebPage(url);
  const hash = contentHash(text);

  const textChunks = chunkText(text, { documentTitle: title });

  return saveDocument({
    title,
    sourceType: "web",
    sourceUrl: url,
    contentHash: hash,
    chunks: textChunks,
  });
}

export async function ingestText(
  content: string,
  title: string,
  sourceUrl?: string
) {
  const hash = contentHash(content);
  const textChunks = chunkText(content, { documentTitle: title });

  return saveDocument({
    title,
    sourceType: "txt",
    sourceUrl,
    contentHash: hash,
    chunks: textChunks,
  });
}

async function saveDocument(params: {
  title: string;
  sourceType: string;
  sourceUrl?: string;
  contentHash: string;
  chunks: TextChunk[];
}) {
  // Insert document
  const [doc] = await db
    .insert(documents)
    .values({
      title: params.title,
      sourceType: params.sourceType,
      sourceUrl: params.sourceUrl ?? null,
      contentHash: params.contentHash,
    })
    .returning();

  // Generate embeddings in batches of 100
  const BATCH_SIZE = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < params.chunks.length; i += BATCH_SIZE) {
    const batch = params.chunks.slice(i, i + BATCH_SIZE);
    const embeddings = await embedMany(batch.map((c) => c.content));
    allEmbeddings.push(...embeddings);
  }

  // Insert chunks with embeddings
  if (params.chunks.length > 0) {
    await db.insert(chunks).values(
      params.chunks.map((chunk, i) => ({
        documentId: doc.id,
        content: chunk.content,
        embedding: allEmbeddings[i],
        chunkIndex: chunk.metadata.chunkIndex,
        tokenCount: chunk.tokenCount,
        metadata: {
          pageNumber: chunk.metadata.pageNumber,
          heading: chunk.metadata.heading,
          documentTitle: chunk.metadata.documentTitle,
        },
      }))
    );
  }

  return { documentId: doc.id, chunkCount: params.chunks.length };
}
