import "dotenv/config";
import { MysqlDialect } from "kysely";
import { Kysely } from "kysely";
import { createPool } from "mysql2";
import { Database } from "../types/database";

const config = useRuntimeConfig();

export const dialect = new MysqlDialect({
  pool: createPool({
    database: config.database.database,
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    port: 3306,
    connectionLimit: 10,
  }),
});

export default new Kysely<Database>({ dialect });
