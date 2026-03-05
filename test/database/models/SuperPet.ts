import { defineModel } from "vasta-orm";
import db from "@/database/db";

// They're super because of their mutations! The X-Pets!
export default class SuperPet extends defineModel({
  db,
  table: "pets",
  attributes: {
    counter: {
      default: 0,
    },
    name: {
      set: (value) => value.toUpperCase(),
    },
  },
}) {
  get upperName() {
    return this.attributes.name.toUpperCase();
  }

  get dateString() {
    return this.attributes.created_at.toDateString();
  }
}
