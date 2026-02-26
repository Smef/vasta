import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import type { Database } from "@/types/database";

let queryCount = 0;

export function resetQueryCount(): void {
  queryCount = 0;
}

export function getQueryCount(): number {
  return queryCount;
}

export const dialect = new PostgresDialect({
  pool: new Pool({
    host: process.env.VITE_DB_HOST,
    port: parseInt(process.env.VITE_DB_PORT || ""),
    database: process.env.VITE_DB_DATABASE,
    user: process.env.VITE_DB_USER,
    password: process.env.VITE_DB_PASSWORD,
    max: 10,
  }),
});

export const kysely = new Kysely<Database>({
  dialect,
  log(event) {
    if (event.level === "query") {
      queryCount += 1;
    }
  },
});

export default kysely;
