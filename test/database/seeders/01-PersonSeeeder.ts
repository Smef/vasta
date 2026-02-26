import { Database } from "@/types/database";
import type { Kysely } from "kysely";

// replace `any` with your database interface.
export async function seed(db: Kysely<Database>): Promise<void> {
  // seed code goes here...
  // note: this function is mandatory. you must implement this function.
  db.insertInto("people")
    .values([
      {
        name: "David",
        birthday: new Date("1986-07-20"),
      },
      {
        name: "Katy",
        birthday: new Date("1986-11-20"),
      },
    ])
    .execute();
}
