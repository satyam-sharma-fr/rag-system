import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { hybridSearch, SearchResult } from "@/lib/utils/hybrid-search";
import { rerankDocuments } from "./rerank";
import { loadActivePrompt, buildRagPrompt } from "./prompts";
import { formatChunksForContext } from "@/lib/utils/citations";
import { db } from "@/lib/db";
import { queryLogs } from "@/lib/db/schema/query-logs";

export async function runRagPipeline(query: string) {
  const startTime = Date.now();

  // 1. Hybrid retrieval
  const retrieved = await hybridSearch(query, 50);

  // 2. Rerank with Cohere
  const reranked = await rerankDocuments(
    query,
    retrieved.map((r) => ({
      ...r,
      id: r.id,
      content: r.content,
    })),
    5
  );

  const topChunks = reranked.map((r) => r.item);

  // 3. Build prompt
  const prompt = loadActivePrompt();
  const contextStr = formatChunksForContext(topChunks);
  const userMessage = buildRagPrompt(prompt.rag_template, contextStr, query);

  // 4. Stream response
  const result = streamText({
    model: openai("gpt-4o"),
    system: prompt.system,
    messages: [{ role: "user", content: userMessage }],
    maxOutputTokens: 2048,
    onFinish: async ({ text, usage }) => {
      const latencyMs = Date.now() - startTime;
      try {
        await db.insert(queryLogs).values({
          query,
          retrievedChunkIds: retrieved.map((r) => r.id),
          rerankedChunkIds: topChunks.map((r) => r.id),
          response: text,
          latencyMs,
          tokenUsage: usage
            ? {
                prompt: usage.inputTokens ?? 0,
                completion: usage.outputTokens ?? 0,
                total: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
              }
            : undefined,
        });
      } catch (e) {
        console.error("Failed to log query:", e);
      }
    },
  });

  return {
    result,
    sources: topChunks,
  };
}
