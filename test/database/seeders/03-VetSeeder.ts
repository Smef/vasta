import { Database } from "@/types/database";
import type { Kysely } from "kysely";

export async function seed(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto("vets")
    .values([
      { name: "Dr. Smith" },
      { name: "Dr. Jones" },
      { name: "Dr. Foster" },
      { name: "Dr. Adams" },
      { name: "Dr. Baker" },
      { name: "Dr. Clark" },
      { name: "Dr. Davis" },
      { name: "Dr. Evans" },
      { name: "Dr. Frank" },
      { name: "Dr. Ghosh" },
      { name: "Dr. Hills" },
      { name: "Dr. Irwin" },
      { name: "Dr. James" },
      { name: "Dr. Klein" },
      { name: "Dr. Lopez" },
      { name: "Dr. Moore" },
      { name: "Dr. Novak" },
      { name: "Dr. Ortiz" },
      { name: "Dr. Patel" },
      { name: "Dr. Quinn" },
    ])
    .execute();
}
