import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as documentsSchema from "./schema/documents";
import * as chunksSchema from "./schema/chunks";
import * as queryLogsSchema from "./schema/query-logs";

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema: {
    ...documentsSchema,
    ...chunksSchema,
    ...queryLogsSchema,
  },
});

export { documentsSchema, chunksSchema, queryLogsSchema };
