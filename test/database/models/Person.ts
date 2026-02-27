import { Model } from "@src/Eloquent/Model";
import { Database } from "@/types/database";
import db from "@/database/db";
import Pet from "@/database/models/Pet";

export default class Person extends Model<Database, "people"> {
  db = db;
  table = "people" as const;
  primaryKey = "id" as const;

  // A Person has many Pets
  get pets() {
    // We pass the Pet class, and the foreign key column on the pets table
    // return this.hasMany(Pet, "person_id", "id", "pets");
    return this.hasMany(Pet, "person_id", "id", "pets");
  }
}
