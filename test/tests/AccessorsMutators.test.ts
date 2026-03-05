import { describe, it, expect } from "vitest";
import { defineModel } from "vasta-orm";
import SuperPet from "@/database/models/SuperPet";
import db from "@/database/db";

describe("Accessors and Mutators", () => {
  it("should support accessors defined in defineModel", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          get: (value: string) => `Accessor: ${value}`,
        },
      },
    }) {}

    // @ts-expect-error - birthday is required, but we'll ignore it for this test
    const user = new User({ name: "Alice" });

    // Attribute override accessor
    expect(user.name).toBe("Accessor: Alice");

    // Reading the attribute through the attributes property should also return the accessor value
    expect(user.attributes.name).toBe("Accessor: Alice");

    // The value should still go through the accessor after setting it
    user.name = "Bob";
    expect(user.name).toBe("Accessor: Bob");
    expect(user.attributes.name).toBe("Accessor: Bob");
  });

  it("should support mutators set in defineModel", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          set: (value) => value.toUpperCase(),
        },
      },
    }) {}

    // setting the attribute through the constructor should trigger the mutator
    const user = new User({ name: "Bob", birthday: new Date() });
    expect(user.attributes.name).toBe("BOB");
    expect(user.name).toBe("BOB");

    // setting the attribute through the instance should trigger the mutator
    user.name = "charlie";
    expect(user.attributes.name).toBe("CHARLIE");
    expect(user.name).toBe("CHARLIE");
  });

  it("should pass the raw value to the accessor", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          get: (value) => value.toUpperCase(),
        },
      },
    }) {}

    const user = new User({ name: "Eve", birthday: new Date() });
    expect(user.name).toBe("EVE");
    expect(user.attributes.name).toBe("EVE");
  });

  it("should support reading computed values", async () => {
    const pet = await SuperPet.firstOrFail();
    // upperName should always reflect the uppercased logical name
    expect(pet.upperName).toBe(pet.attributes.name.toUpperCase());
  });

  it("should error when trying to write to computed values", async () => {
    const pet = await SuperPet.firstOrFail();
    try {
      // @ts-expect-error - upperName is read-only
      pet.upperName = "FLUFFY2";
    } catch (error: any) {
      expect(error).toBeInstanceOf(TypeError);
      expect(String(error.message)).toContain("upperName");
    }
  });

  it("should throw a type error when defining an accessor which returns a different type", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          // @ts-expect-error - the return type is not a string
          get: (value) => {
            return {
              firstName: value.split(" ")[0],
              lastName: value.split(" ")[1],
            };
          },
        },
      },
    }) {}
  });

  it(" should throw a type error when defining a mutator which returns a different type", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          // @ts-expect-error - the return type is not a string
          set: (value) => {
            return {
              firstName: value.split(" ")[0],
              lastName: value.split(" ")[1],
            };
          },
        },
      },
    }) {}
  });

  it("should trigger mutators for mass assignment", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          set: (value) => value.toUpperCase(),
        },
      },
    }) {}

    const user = new User({ name: "Charlie", birthday: new Date() });
    user.assign({ name: "Dave" });
    expect(user.attributes.name).toBe("DAVE");
    expect(user.name).toBe("DAVE");
  });

  it("should apply mutators only once on assign (non-idempotent mutator)", () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          set: (value) => `${value}!`,
        },
      },
    }) {}

    const user = new User({ name: "Bob", birthday: new Date() });
    expect(user.name).toBe("Bob!");
    user.assign({ name: "Alice" });
    expect(user.attributes.name).toBe("Alice!");
    expect(user.name).toBe("Alice!");
  });

  it("should not show dirty when there are accessors and no attributes have actually changed", async () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          get: (value) => value.toUpperCase(),
        },
      },
    }) {}

    const user = new User({ name: "Charlie", birthday: new Date() });
    await user.save();
    expect(user.isDirty()).toBe(false);
    expect(user.getDirty()).toEqual({});

    user.delete();
  });

  it("should allow access to raw attributes without triggering accessors", async () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          get: (value) => value.toUpperCase(),
        },
      },
    }) {}

    const user = new User({ name: "Charlie", birthday: new Date() });

    // the accessor should be triggered when reading the attribute
    expect(user.name).toBe("CHARLIE");

    // the raw attributes should not be affected by the accessor
    const rawAttributes = user.getRawAttributes();
    expect(rawAttributes.name).toBe("Charlie");
  });

  it("should set raw attributes without triggering mutators", async () => {
    class User extends defineModel({
      db,
      table: "people",
      attributes: {
        name: {
          set: (value) => value.toUpperCase(),
        },
      },
    }) {}

    const user = new User({ name: "Charlie", birthday: new Date() });
    expect(user.name).toBe("CHARLIE");

    // setting the attribute through setRawAttributes should not trigger the mutator
    user.setRawAttributes({ name: "Dave" });
    expect(user.name).toBe("Dave"); // should not be uppercase
  });
});
