import { defineModel } from "vasta-orm";
import Person from "@/database/models/Person";
import Vet from "@/database/models/Vet";
import db from "@/database/db";

export default class Pet extends defineModel({
  db,
  table: "pets",
  attributes: {
    counter: {
      default: 0,
    },
  },
}) {
  // A Pet belongs to a Person
  get owner() {
    return this.belongsTo(Person, "person_id", "id");
  }

  // A Pet has many Vets
  get vets() {
    return this.belongsToMany(Vet, "vet_visits", "pet_id", "vet_id");
  }

  incrementCounter() {
    this.attributes.counter += 1;
    return this.save();
  }
}
