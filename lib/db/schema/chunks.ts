import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  index,
  vector,
} from "drizzle-orm/pg-core";
import { documents } from "./documents";

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 3072 }).notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    tokenCount: integer("token_count").notNull(),
    metadata: jsonb("metadata").$type<{
      pageNumber?: number;
      heading?: string;
      documentTitle?: string;
    }>(),
  },
  (table) => [
    index("chunks_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops")
    ),
    index("chunks_content_trgm_idx")
      .using("gin", table.content)
      .concurrently(),
  ]
);

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
