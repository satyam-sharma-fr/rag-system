import { readFileSync } from "fs";
import { join } from "path";

export interface PromptConfig {
  version: string;
  system: string;
  rag_template: string;
  no_answer: string;
  created_at: string;
  notes: string;
}

export function loadActivePrompt(): PromptConfig {
  const activeConfig = JSON.parse(
    readFileSync(join(process.cwd(), "config/prompts/active.json"), "utf-8")
  );

  const prompt = JSON.parse(
    readFileSync(
      join(process.cwd(), `config/prompts/${activeConfig.active_version}.json`),
      "utf-8"
    )
  );

  return prompt;
}

export function buildRagPrompt(
  template: string,
  chunks: string,
  query: string
): string {
  return template.replace("{chunks}", chunks).replace("{query}", query);
}
