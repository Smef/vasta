import { Model } from "@src/Eloquent/Model";
import { Database } from "@/types/database";
import db from "../db";
import Person from "@/database/models/Person";

export default class Pet extends Model<Database, "pets"> {
  db = db;
  primaryKey = "id" as const;
  table = "pets" as const;

  // A Pet belongs to a Person
  get owner() {
    // return this.belongsTo(Person, "person_id", "id", "owner");
    return this.belongsTo(Person, "person_id", "id", "owner");
  }

  incrementCounter() {
    this.attributes.counter += 1;
    return this.save();
  }
}
