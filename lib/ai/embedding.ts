import { embed, embedMany as aiEmbedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const embeddingModel = openai.embedding("text-embedding-3-large");

export async function embedQuery(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });
  return embedding;
}

export async function embedMany(texts: string[]): Promise<number[][]> {
  const { embeddings } = await aiEmbedMany({
    model: embeddingModel,
    values: texts,
  });
  return embeddings;
}
