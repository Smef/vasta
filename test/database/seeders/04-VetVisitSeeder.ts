import { Database } from "@/types/database";
import type { Kysely } from "kysely";

export async function seed(db: Kysely<Database>): Promise<void> {
  const visit_date = new Date().toISOString();
  await db
    .insertInto("vet_visits")
    .values([
      { pet_id: 1, vet_id: 1, visit_date }, // Zuko visited Dr. Smith
      { pet_id: 1, vet_id: 2, visit_date }, // Zuko visited Dr. Jones
      { pet_id: 2, vet_id: 1, visit_date }, // Yoshi visited Dr. Smith
      { pet_id: 3, vet_id: 3, visit_date },
      { pet_id: 4, vet_id: 4, visit_date },
      { pet_id: 5, vet_id: 5, visit_date },
      { pet_id: 6, vet_id: 6, visit_date },
      { pet_id: 7, vet_id: 7, visit_date },
      { pet_id: 8, vet_id: 8, visit_date },
      { pet_id: 9, vet_id: 9, visit_date },
      { pet_id: 10, vet_id: 10, visit_date },
      { pet_id: 11, vet_id: 11, visit_date },
      { pet_id: 12, vet_id: 12, visit_date },
      { pet_id: 13, vet_id: 13, visit_date },
      { pet_id: 14, vet_id: 14, visit_date },
      { pet_id: 15, vet_id: 15, visit_date },
      { pet_id: 16, vet_id: 16, visit_date },
      { pet_id: 17, vet_id: 17, visit_date },
      { pet_id: 18, vet_id: 18, visit_date },
      { pet_id: 19, vet_id: 19, visit_date },
      { pet_id: 20, vet_id: 20, visit_date },
      { pet_id: 21, vet_id: 1, visit_date },
      { pet_id: 22, vet_id: 2, visit_date },

      // additional visits
      { pet_id: 3, vet_id: 5, visit_date },
      { pet_id: 3, vet_id: 7, visit_date },
      { pet_id: 4, vet_id: 1, visit_date },
      { pet_id: 4, vet_id: 10, visit_date },
      { pet_id: 8, vet_id: 2, visit_date },
      { pet_id: 8, vet_id: 3, visit_date },
      { pet_id: 15, vet_id: 5, visit_date },
      { pet_id: 15, vet_id: 8, visit_date },
      { pet_id: 15, vet_id: 12, visit_date },
      { pet_id: 20, vet_id: 4, visit_date },
      { pet_id: 20, vet_id: 8, visit_date },
      { pet_id: 20, vet_id: 16, visit_date },
      { pet_id: 21, vet_id: 3, visit_date },
    ])
    .execute();
}
