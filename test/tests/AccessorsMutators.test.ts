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
      expect(error.message).toBe("'set' on proxy: trap returned falsish for property 'upperName'");
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
});
