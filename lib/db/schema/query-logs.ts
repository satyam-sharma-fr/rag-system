import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const queryLogs = pgTable("query_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  query: text("query").notNull(),
  retrievedChunkIds: jsonb("retrieved_chunk_ids").$type<string[]>(),
  rerankedChunkIds: jsonb("reranked_chunk_ids").$type<string[]>(),
  response: text("response"),
  citations: jsonb("citations").$type<
    { chunkId: string; sourceIndex: number; text: string }[]
  >(),
  latencyMs: integer("latency_ms"),
  tokenUsage: jsonb("token_usage").$type<{
    prompt: number;
    completion: number;
    total: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type QueryLog = typeof queryLogs.$inferSelect;
export type NewQueryLog = typeof queryLogs.$inferInsert;
