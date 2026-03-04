import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

const rerankModel = cohere.reranking("rerank-v3.5");

export interface RerankableItem {
  id: string;
  content: string;
  [key: string]: unknown;
}

export async function rerankDocuments<T extends RerankableItem>(
  query: string,
  documents: T[],
  topN: number = 5
): Promise<{ item: T; score: number; index: number }[]> {
  if (documents.length === 0) return [];

  const { ranking } = await rerank({
    model: rerankModel,
    query,
    documents: documents.map((d) => d.content),
    topN,
  });

  return ranking.map((entry) => ({
    item: documents[entry.originalIndex],
    score: entry.score,
    index: entry.originalIndex,
  }));
}
