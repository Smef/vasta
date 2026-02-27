import { defineModel } from "vasta";
import Person from "@/database/models/Person";
import db from "@/database/db";

export default class Pet extends defineModel({
  db,
  table: "pets",
}) {
  // A Pet belongs to a Person
  get owner() {
    return this.belongsTo(Person, "person_id", "id", "owner");
  }
  incrementCounter() {
    this.attributes.counter += 1;
    return this.save();
  }
}
