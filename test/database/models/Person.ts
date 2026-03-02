import { defineModel } from "vasta";
import db from "@/database/db";
import Pet from "@/database/models/Pet";

export default class Person extends defineModel({
  db,
  table: "people",
  hidden: ["secret"],
}) {
  // A Person has many Pets
  get pets() {
    // We pass the Pet class, and the foreign key column on the pets table
    return this.hasMany(Pet, "person_id", "id");
  }
}
