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
      {
        name: "Biscuit",
        type: "dog",
        counter: 2,
        person_id: 3,
      },
      {
        name: "Nori",
        type: "fish",
        counter: 5,
        person_id: 3,
      },
      {
        name: "Milo",
        type: "dog",
        counter: 1,
        person_id: 4,
      },
      {
        name: "Luna",
        type: "cat",
        counter: 3,
        person_id: 5,
      },
      {
        name: "Pico",
        type: "bird",
        counter: 0,
        person_id: 5,
      },
      {
        name: "Otis",
        type: "dog",
        counter: 4,
        person_id: 2,
      },
      {
        name: "Willow",
        type: "cat",
        counter: 1,
        person_id: 3,
      },
      {
        name: "Comet",
        type: "bird",
        counter: 2,
        person_id: 4,
      },
      {
        name: "Poppy",
        type: "rabbit",
        counter: 0,
        person_id: 4,
      },
      {
        name: "Rex",
        type: "dog",
        counter: 6,
        person_id: 1,
      },
      {
        name: "Mochi",
        type: "cat",
        counter: 2,
        person_id: 5,
      },
      {
        name: "Skye",
        type: "bird",
        counter: 1,
        person_id: 3,
      },
    ])
    .execute();
}
