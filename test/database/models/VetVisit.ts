import { defineModel } from "vasta-orm";
import Pet from "@/database/models/Pet";
import Vet from "@/database/models/Vet";
import db from "@/database/db";

export default class VetVisit extends defineModel({
  db,
  table: "vet_visits",
}) {
  get pet() {
    return this.belongsTo(Pet, "pet_id", "id");
  }
  get vet() {
    return this.belongsTo(Vet, "vet_id", "id");
  }
}
