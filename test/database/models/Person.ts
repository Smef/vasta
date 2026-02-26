import { Model } from "@src/Eloquent/Model";
import { Database } from "@/types/database";
import db from "../db";
import Pet from "./Pet";

export default class Person extends Model<Database, "people"> {
  db = db;
  primaryKey = "id" as const;
  table = "people" as const;

  // A Person has many Pets
  get pets() {
    // We pass the Pet class, and the foreign key column on the pets table
    // return this.hasMany(Pet, "person_id", "id", "pets");
    return this.hasMany(Pet, "person_id", "id", "pets");
  }
}
