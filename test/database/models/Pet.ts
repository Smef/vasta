import { defineModel, RequireSelected } from "vasta-orm";
import Person from "@/database/models/Person";
import Vet from "@/database/models/Vet";
import db from "@/database/db";

type Requires<K extends keyof Pet["attributes"] & string> = RequireSelected<Pet, K>;

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

  // Restrict 'this' to require the 'counter' attribute
  incrementCounter(this: Requires<"counter">) {
    this.attributes.counter += 1;
  }

  // Restrict 'this' to require BOTH 'counter' and 'id'
  async incrementAndSave(this: RequireSelected<Pet, "counter" | "id">) {
    this.incrementCounter(); // Valid, because we required "counter"
    await this.save(); // Valid, because we required "id" (the primary key)
  }

  incrementCounterWithoutSafety() {
    this.attributes.counter += 1;
  }
}
