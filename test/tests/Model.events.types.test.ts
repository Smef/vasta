import { describe, expect, it } from "vitest";

import db from "@/database/db";
import { defineModel } from "vasta";

describe("lifecycle event typing", () => {
  it("should type lifecycle event handlers from defineModel config", () => {
    class EventedPet extends defineModel({
      db,
      table: "pets",
      events: {
        saving: (model) => {
          const petName: string = model.attributes.name;
          expect(typeof petName).toBe("string");
        },
        created: (model) => {
          const petId: number = model.attributes.id;
          expect(typeof petId).toBe("number");
        },
      },
    }) {}

    const pet = new EventedPet({ name: "Typecheck", type: "cat", counter: 0 });
    expect(pet.attributes.name).toBe("Typecheck");
  });

  it("should reject invalid lifecycle event definitions", () => {
    defineModel({
      db,
      table: "pets",
      events: {
        // @ts-expect-error invalid lifecycle event name
        createed: () => {},
      },
    });

    defineModel({
      db,
      table: "pets",
      events: {
        // @ts-expect-error handler must accept a model-shaped parameter
        created: (model: number) => {
          void model;
        },
      },
    });

    defineModel({
      db,
      table: "pets",
      events: {
        saving: async (model) => {
          const petType: string = model.attributes.type;
          void petType;
        },
      },
    });

    defineModel({
      db,
      table: "pets",
      events: {
        // @ts-expect-error async handlers must resolve to void
        created: async (model) => {
          void model;
          return "invalid return type";
        },
      },
    });
  });
});
