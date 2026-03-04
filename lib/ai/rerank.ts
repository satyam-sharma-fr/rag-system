import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

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

  // Gracefully degrade if no Cohere API key
  if (!process.env.COHERE_API_KEY) {
    console.warn("COHERE_API_KEY not set, skipping reranking");
    return documents.slice(0, topN).map((item, index) => ({
      item,
      score: 1 - index * 0.1,
      index,
    }));
  }

  const rerankModel = cohere.reranking("rerank-v3.5");

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
