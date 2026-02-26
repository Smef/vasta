import { Database } from "@/types/database";
import type { Kysely } from "kysely";

// replace `any` with your database interface.
export async function seed(db: Kysely<Database>): Promise<void> {
  // seed code goes here...
  // note: this function is mandatory. you must implement this function.
  await db
    .insertInto("pets")
    .values([
      {
        name: "Zuko",
        type: "bird",
        counter: 0,
        person_id: 1,
      },
      {
        name: "Yoshi",
        type: "bird",
        counter: 0,
        person_id: 1,
      },
      {
        name: "Astrid",
        type: "cat",
        counter: 0,
        person_id: 2,
      },
      {
        name: "Cosmo",
        type: "cat",
        counter: 0,
        person_id: 2,
      },
    ])
    .execute();
}
