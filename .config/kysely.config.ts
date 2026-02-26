import { defineConfig } from "kysely-ctl";
import { kysely, dialect } from "../test/database";

export default defineConfig({
  kysely, // pass your Kysely instance here
  dialect,
  // replace me with a real dialect instance OR a dialect name + `dialectConfig` prop.
  //   dialect: {
  //     createAdapter() {
  //       return new PostgresAdapter();
  //     },
  //     createDriver() {
  //       return new DummyDriver();
  //     },
  //     createIntrospector(db) {
  //       return new PostgresIntrospector(db);
  //     },
  //     createQueryCompiler() {
  //       return new PostgresQueryCompiler();
  //     },
  //   },
  migrations: {
    migrationFolder: "../test/database/migrations",
  },
  //   plugins: [],
  seeds: {
    seedFolder: "../test/database/seeders",
  },
});
