import { defineModel } from "vasta-orm";
import Pet from "@/database/models/Pet";
import db from "@/database/db";

export default class Vet extends defineModel({
  db,
  table: "vets",
}) {
  get pets() {
    return this.belongsToMany(Pet, "vet_visits", "vet_id", "pet_id");
  }
}
