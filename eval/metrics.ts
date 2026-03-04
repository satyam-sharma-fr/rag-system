import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const judgeModel = openai("gpt-4o");

export interface EvalScores {
  faithfulness: number;
  contextPrecision: number;
  answerRelevance: number;
  citationAccuracy: number;
}

export async function scoreFaithfulness(
  answer: string,
  context: string
): Promise<number> {
  const { object } = await generateObject({
    model: judgeModel,
    schema: z.object({
      claims: z.array(
        z.object({
          claim: z.string(),
          supported: z.boolean(),
        })
      ),
    }),
    prompt: `Extract every factual claim from the answer and determine if each is supported by the context.

Context:
${context}

Answer:
${answer}

List each claim and whether it is supported (true/false).`,
  });

  if (object.claims.length === 0) return 1;
  const supported = object.claims.filter((c) => c.supported).length;
  return supported / object.claims.length;
}

export async function scoreContextPrecision(
  question: string,
  chunks: string[]
): Promise<number> {
  const { object } = await generateObject({
    model: judgeModel,
    schema: z.object({
      relevance: z.array(
        z.object({
          chunkIndex: z.number(),
          relevant: z.boolean(),
        })
      ),
    }),
    prompt: `Given the question, determine if each context chunk is relevant to answering it.

Question: ${question}

Chunks:
${chunks.map((c, i) => `[Chunk ${i}]: ${c}`).join("\n\n")}

For each chunk, state whether it is relevant (true/false).`,
  });

  if (object.relevance.length === 0) return 0;
  const relevant = object.relevance.filter((r) => r.relevant).length;
  return relevant / object.relevance.length;
}

export async function scoreAnswerRelevance(
  question: string,
  answer: string
): Promise<number> {
  const { object } = await generateObject({
    model: judgeModel,
    schema: z.object({
      score: z.number().min(0).max(1),
      reasoning: z.string(),
    }),
    prompt: `Rate how well the answer addresses the question on a scale from 0 to 1.
0 = completely irrelevant, 1 = perfectly addresses the question.

Question: ${question}
Answer: ${answer}

Provide a score and brief reasoning.`,
  });

  return object.score;
}

export function scoreCitationAccuracy(
  answer: string,
  numSources: number
): number {
  const regex = /\[Source\s+(\d+)\]/g;
  const cited: number[] = [];
  let match;
  while ((match = regex.exec(answer)) !== null) {
    cited.push(parseInt(match[1], 10));
  }

  if (cited.length === 0) {
    // If no citations and answer is a refusal, that's OK
    if (answer.includes("cannot answer")) return 1;
    return 0;
  }

  const valid = cited.filter((n) => n >= 1 && n <= numSources);
  return valid.length / cited.length;
}
