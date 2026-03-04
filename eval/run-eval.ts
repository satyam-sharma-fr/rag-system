import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { hybridSearch } from "../lib/utils/hybrid-search";
import { rerankDocuments } from "../lib/ai/rerank";
import { loadActivePrompt, buildRagPrompt } from "../lib/ai/prompts";
import { formatChunksForContext } from "../lib/utils/citations";
import {
  scoreFaithfulness,
  scoreContextPrecision,
  scoreAnswerRelevance,
  scoreCitationAccuracy,
  EvalScores,
} from "./metrics";

interface GoldenEntry {
  id: string;
  question: string;
  expected_answer: string;
  source_document: string;
  source_chunk_keywords: string[];
}

interface EvalResult {
  id: string;
  question: string;
  expected_answer: string;
  actual_answer: string;
  scores: EvalScores;
  retrievedChunks: number;
  rerankedChunks: number;
}

const THRESHOLDS = {
  faithfulness: 0.85,
  citationAccuracy: 0.9,
  contextPrecision: 0.7,
  answerRelevance: 0.7,
};

const evalDir = dirname(fileURLToPath(import.meta.url));

async function runEval() {
  const goldenPath = join(evalDir, "golden-dataset.json");
  const golden: GoldenEntry[] = JSON.parse(readFileSync(goldenPath, "utf-8"));

  console.log(`Running evaluation on ${golden.length} questions...\n`);

  const prompt = loadActivePrompt();
  const results: EvalResult[] = [];

  for (const entry of golden) {
    console.log(`[${entry.id}] ${entry.question}`);

    try {
      // 1. Retrieve
      const retrieved = await hybridSearch(entry.question, 50);

      // 2. Rerank
      const reranked = await rerankDocuments(
        entry.question,
        retrieved.map((r) => ({
          ...r,
          id: r.id,
          content: r.content,
        })),
        5
      );
      const topChunks = reranked.map((r) => r.item);

      // 3. Generate
      const contextStr = formatChunksForContext(topChunks);
      const userMessage = buildRagPrompt(
        prompt.rag_template,
        contextStr,
        entry.question
      );

      const { text: answer } = await generateText({
        model: openai("gpt-4o"),
        system: prompt.system,
        messages: [{ role: "user", content: userMessage }],
        maxOutputTokens: 2048,
      });

      // 4. Score
      const [faithfulness, contextPrecision, answerRelevance] =
        await Promise.all([
          scoreFaithfulness(answer, contextStr),
          scoreContextPrecision(
            entry.question,
            topChunks.map((c) => c.content)
          ),
          scoreAnswerRelevance(entry.question, answer),
        ]);

      const citationAccuracy = scoreCitationAccuracy(
        answer,
        topChunks.length
      );

      const scores: EvalScores = {
        faithfulness,
        contextPrecision,
        answerRelevance,
        citationAccuracy,
      };

      results.push({
        id: entry.id,
        question: entry.question,
        expected_answer: entry.expected_answer,
        actual_answer: answer,
        scores,
        retrievedChunks: retrieved.length,
        rerankedChunks: topChunks.length,
      });

      console.log(
        `  Faith: ${faithfulness.toFixed(2)} | Ctx: ${contextPrecision.toFixed(2)} | Rel: ${answerRelevance.toFixed(2)} | Cite: ${citationAccuracy.toFixed(2)}`
      );
    } catch (err) {
      console.error(`  ERROR: ${err}`);
      results.push({
        id: entry.id,
        question: entry.question,
        expected_answer: entry.expected_answer,
        actual_answer: "ERROR",
        scores: {
          faithfulness: 0,
          contextPrecision: 0,
          answerRelevance: 0,
          citationAccuracy: 0,
        },
        retrievedChunks: 0,
        rerankedChunks: 0,
      });
    }
  }

  // Aggregate
  const avg = (key: keyof EvalScores) =>
    results.reduce((sum, r) => sum + r.scores[key], 0) / results.length;

  const summary = {
    totalQuestions: results.length,
    averages: {
      faithfulness: avg("faithfulness"),
      contextPrecision: avg("contextPrecision"),
      answerRelevance: avg("answerRelevance"),
      citationAccuracy: avg("citationAccuracy"),
    },
    thresholds: THRESHOLDS,
    passed: true,
    failedMetrics: [] as string[],
  };

  for (const [key, threshold] of Object.entries(THRESHOLDS)) {
    const value = summary.averages[key as keyof typeof summary.averages];
    if (value < threshold) {
      summary.passed = false;
      summary.failedMetrics.push(
        `${key}: ${value.toFixed(3)} < ${threshold}`
      );
    }
  }

  const resultsDir = join(evalDir, "results");
  mkdirSync(resultsDir, { recursive: true });

  writeFileSync(
    join(resultsDir, "eval-results.json"),
    JSON.stringify({ summary, results }, null, 2)
  );

  console.log("\n=== EVALUATION SUMMARY ===");
  console.log(
    `Faithfulness:      ${summary.averages.faithfulness.toFixed(3)} (threshold: ${THRESHOLDS.faithfulness})`
  );
  console.log(
    `Context Precision: ${summary.averages.contextPrecision.toFixed(3)} (threshold: ${THRESHOLDS.contextPrecision})`
  );
  console.log(
    `Answer Relevance:  ${summary.averages.answerRelevance.toFixed(3)} (threshold: ${THRESHOLDS.answerRelevance})`
  );
  console.log(
    `Citation Accuracy: ${summary.averages.citationAccuracy.toFixed(3)} (threshold: ${THRESHOLDS.citationAccuracy})`
  );
  console.log(`\nResult: ${summary.passed ? "PASSED" : "FAILED"}`);

  if (!summary.passed) {
    console.error(`\nFailed metrics: ${summary.failedMetrics.join(", ")}`);
    process.exit(1);
  }
}

runEval().catch((err) => {
  console.error("Eval failed:", err);
  process.exit(1);
});
