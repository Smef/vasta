import { describe, it, expect } from "vitest";
import Pet from "@/database/models/Pet";

describe("Function Type Safety", () => {
  it("should show a type error when trying to call a function that requires a primary key when a key was not selected", async () => {
    const pet = new Pet({ name: "toBeDeleted", type: "cat" });
    await pet.save();
    expect(pet.attributes.id).toBeDefined();

    const id = pet.attributes.id;

    const selectedPet = await Pet.select(["name"]).where("name", pet.name).firstOrFail();

    selectedPet.name = "New Name";
    // this should throw a type error because the primary key is not selected
    if (false) {
      // @ts-expect-error - primary key is not selected
      await selectedPet.save();
      // @ts-expect-error - primary key is not selected
      await selectedPet.delete();
    }

    const goodSelectedPet = await Pet.select(["name", "id"]).where("name", pet.name).firstOrFail();
    goodSelectedPet.name = "New Name";
    await goodSelectedPet.save();
    await goodSelectedPet.delete();
  });

  it("should not show a type error when calling a function with the required columns selected", async () => {
    const pet = new Pet({ name: "toBeDeleted", type: "cat" });
    await pet.save();
    expect(pet.attributes.id).toBeDefined();

    const selectedPet = await Pet.select(["name", "id"]).where("name", pet.name).firstOrFail();
    selectedPet.name = "New Name";
    await selectedPet.save();
    await selectedPet.delete();
  });

  it("should show a type error when trying to call a function that requires a column that was not selected", async () => {
    const pet = new Pet({ name: "toBeDeleted", type: "cat" });
    await pet.save();
    expect(pet.attributes.id).toBeDefined();

    const selectedPet = await Pet.select(["name"]).where("name", pet.name).firstOrFail();

    // @ts-expect-error - counter is not selected
    selectedPet.incrementCounter();

    const goodSelectedPet = await Pet.select(["counter", "name"]).where("name", pet.name).firstOrFail();
    // it should not throw a type error because the counter is selected
    goodSelectedPet.incrementCounter();
  });

  it("should show a type error when trying to call a function that requires multiple columns that were not selected", async () => {
    const pet = new Pet({ name: "toBeDeleted", type: "cat" });
    await pet.save();
    expect(pet.attributes.id).toBeDefined();

    let selectedPet = await Pet.select(["name"]).where("name", pet.name).firstOrFail();

    if (false) {
      // @ts-expect-error - id and counter are not selected
      await selectedPet.incrementAndSave();
    }

    const goodSelectedPet = await Pet.select(["counter", "id", "name"]).where("name", pet.name).firstOrFail();
    // it should not throw a type error because the counter is selected
    await goodSelectedPet.incrementAndSave();

    await goodSelectedPet.delete();
  });

  it("should not show a type error when calling a function that does not require any columns to be selected", async () => {
    const pet = new Pet({ name: "toBeDeleted", type: "cat" });
    await pet.save();
    expect(pet.attributes.id).toBeDefined();

    const selectedPet = await Pet.select(["name"]).where("name", pet.name).firstOrFail();
    selectedPet.incrementCounterWithoutSafety();
  });
});
