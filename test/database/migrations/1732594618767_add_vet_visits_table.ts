import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("vet_visits")
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("pet_id", "integer", (col) => col.references("pets.id").onDelete("cascade"))
    .addColumn("vet_id", "integer", (col) => col.references("vets.id").onDelete("cascade"))
    .addColumn("visit_date", "timestamp", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("vet_visits").execute();
}
