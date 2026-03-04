import { db } from "@/lib/db";
import { chunks } from "@/lib/db/schema/chunks";
import { documents } from "@/lib/db/schema/documents";
import { cosineDistance, sql, desc, eq } from "drizzle-orm";
import { embedQuery } from "@/lib/ai/embedding";

export interface SearchResult {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  pageNumber?: number;
  heading?: string;
  score: number;
}

const RRF_K = 60;
const TOP_K_CANDIDATES = 50;

export async function hybridSearch(
  query: string,
  limit: number = TOP_K_CANDIDATES
): Promise<SearchResult[]> {
  const queryEmbedding = await embedQuery(query);

  // Vector search: cosine similarity via pgvector
  const vectorResults = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      documentId: chunks.documentId,
      chunkIndex: chunks.chunkIndex,
      metadata: chunks.metadata,
      distance: cosineDistance(chunks.embedding, queryEmbedding),
    })
    .from(chunks)
    .orderBy(cosineDistance(chunks.embedding, queryEmbedding))
    .limit(limit);

  // Keyword search: trigram similarity + full text search
  const keywordResults = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      documentId: chunks.documentId,
      chunkIndex: chunks.chunkIndex,
      metadata: chunks.metadata,
      rank: sql<number>`
        ts_rank(
          to_tsvector('english', ${chunks.content}),
          plainto_tsquery('english', ${query})
        ) + similarity(${chunks.content}, ${query})
      `,
    })
    .from(chunks)
    .where(
      sql`(
        to_tsvector('english', ${chunks.content}) @@ plainto_tsquery('english', ${query})
        OR similarity(${chunks.content}, ${query}) > 0.1
      )`
    )
    .orderBy(
      desc(
        sql`ts_rank(to_tsvector('english', ${chunks.content}), plainto_tsquery('english', ${query})) + similarity(${chunks.content}, ${query})`
      )
    )
    .limit(limit);

  // Reciprocal Rank Fusion
  const rrfScores = new Map<string, { score: number; data: any }>();

  vectorResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    rrfScores.set(result.id, {
      score: rrfScore,
      data: result,
    });
  });

  keywordResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = rrfScores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      rrfScores.set(result.id, {
        score: rrfScore,
        data: result,
      });
    }
  });

  // Sort by combined RRF score
  const fusedResults = Array.from(rrfScores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit);

  // Fetch document titles
  const docIds = [...new Set(fusedResults.map(([, r]) => r.data.documentId))];
  const docs = await db
    .select({ id: documents.id, title: documents.title })
    .from(documents)
    .where(sql`${documents.id} IN ${docIds}`);

  const docTitleMap = new Map(docs.map((d) => [d.id, d.title]));

  return fusedResults.map(([id, { score, data }]) => ({
    id,
    content: data.content,
    documentId: data.documentId,
    documentTitle: docTitleMap.get(data.documentId) || "Unknown",
    chunkIndex: data.chunkIndex,
    pageNumber: data.metadata?.pageNumber,
    heading: data.metadata?.heading,
    score,
  }));
}
