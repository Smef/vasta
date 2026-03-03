import { describe, it, expect } from "vitest";
import { defineModel } from "vasta-orm";

import Pet from "@/database/models/Pet";
import Vet from "../database/models/Vet";
import VetVisit from "../database/models/VetVisit";
import Person from "@/database/models/Person";
import { getQueryCount, resetQueryCount } from "@/database/db";
import db from "@/database/db";
import Builder from "@src/model/Builder";

describe("find", () => {
  it("should find a record by id", async () => {
    const pet = await Pet.find(1);
    expectToBeDefined(pet);

    expect(pet.attributes.id).toBe(1);
    expect(pet.attributes.name).toBe("Zuko");
  });

  it("should return null for non-existent record", async () => {
    const pet = await Pet.find(999);
    expect(pet).toBeUndefined();
  });

  it("should find multiple records by id", async () => {
    const pets = await Pet.find([2, 4]);
    expect(pets).toHaveLength(2);
    expectToBeDefined(pets);
    if (!pets) return;
    expect(pets[0].attributes.id).toBe(2);
    expect(pets[1].attributes.id).toBe(4);
  });

  it("should find multiple records by id", async () => {
    const pets = await Pet.findOrFail([2, 4]);
    expect(pets).toHaveLength(2);
    if (!pets) return;
    expect(pets[0].attributes.id).toBe(2);
    expect(pets[1].attributes.id).toBe(4);
  });

  it("should enforce primary key typing for find", () => {
    void Pet.find(1);
    void Pet.find([1, 2]);

    // @ts-expect-error - Pet primary key is numeric
    void Pet.find("1");
    // @ts-expect-error - Pet primary key is numeric
    void Pet.find(["1", "2"]);

    class PetByName extends defineModel({
      db,
      table: "pets",
      primaryKey: "name",
    }) {}

    const foundPetByName = PetByName.findOrFail("Zuko");
    expectToBeDefined(foundPetByName);

    void PetByName.find(["Zuko", "Yoshi"]);

    // @ts-expect-error - PetByName primary key is string
    void PetByName.find(123);
    // @ts-expect-error - PetByName primary key is string
    void PetByName.find([1, 2]);
  });
});

describe("constructor", () => {
  it("should create a new instance with provided attributes", () => {
    const pet = new Pet({
      name: "Fluffy",
      counter: 1,
      type: "cat",
    });

    expect(pet.attributes.name).toBe("Fluffy");
    expect(pet.attributes.counter).toBe(1);
  });

  it("should apply default attributes if not provided", () => {
    const pet = new Pet({
      name: "Defaulted",
      type: "cat",
    });

    expect(pet.attributes.name).toBe("Defaulted");
    expect(pet.attributes.counter).toBe(0); // Default from config

    // saving should work without providing counter
    expect(pet.save()).resolves.not.toThrow();
  });

  it("should evaluate sync function defaults immediately upon instantiation", async () => {
    class Dummy extends defineModel({
      db,
      table: "pets",
      attributes: {
        type: "dragon",
        name: () => "Smaug",
        counter: () => 1000,
      },
    }) {}

    const dummy = new Dummy({});

    // Sync functions are evaluated and assigned inside constructor
    expect(dummy.type).toBe("dragon");
    expect(dummy.counter).toBe(1000);
    expect(dummy.name).toBe("Smaug");
  });

  it("should have type errors when providing invalid attribute types", async () => {
    await Person.where("name", "David").get();
    // @ts-expect-error - name should be a string
    await Person.where("name", 123).get();

    const pets = await Pet.where("type", "=", "cat").get();
    // @ts-expect-error - type should not be a number
    const invalidPets = await Pet.where("type", "=", 123).get();

    const inPets = await Pet.whereIn("type", ["cat", "dog"]).get();
    // @ts-expect-error - type should not be an array of numbers
    const invalidInPets = await Pet.whereIn("type", [123]).get();
  });

  it("should have a type error if a required attribute is not provided even after applying defaults", async () => {
    // @ts-expect-error - type is required
    const pet = new Pet({
      name: "Defaulted",
    });

    // saving should have an error
    await expect(pet.save()).rejects.toThrowError(
      'null value in column "type" of relation "pets" violates not-null constraint',
    );
  });

  it("should overwrite default attributes with provided values", () => {
    const pet = new Pet({
      name: "Fluffy",
      counter: 1,
      type: "cat",
    });

    expect(pet.attributes.name).toBe("Fluffy");
    expect(pet.attributes.counter).toBe(1);
  });

  it("should snapshot originalAttributes on instantiation", () => {
    const pet = new Pet({
      name: "Fluffy",
      type: "cat",
    });

    // make sure default attributes are also set
    expect(pet.originalAttributes.name).toBe("Fluffy");
    expect(pet.originalAttributes.counter).toBe(0);
    expect(pet.originalAttributes.type).toBe("cat");
  });

  it("should have a type error when creating an instance with invalid attributes", () => {
    const pet = new Pet({
      name: "Fluffy",
      counter: 1,
      type: "cat",
      // @ts-expect-error
      invalidAttribute: "invalid",
    });

    expect(pet.attributes.name).toBe("Fluffy");
  });
});

describe("assign", () => {
  it("should mass assign attributes", () => {
    const pet = new Pet({
      name: "Original",
      counter: 1,
      type: "dog",
    });

    pet.assign({ name: "Fluffy", counter: 10 });

    expect(pet.attributes.name).toBe("Fluffy");
    expect(pet.attributes.counter).toBe(10);
    expect(pet.attributes.type).toBe("dog");
  });

  it("should allow chaining", () => {
    const pet = new Pet({ name: "Fluffy", type: "cat" });
    expect(pet.assign({ counter: 5 })).toBe(pet);
  });

  it("should mark model as dirty after assign", async () => {
    const pet = await Pet.findOrFail(1);

    expect(pet.isDirty()).toBe(false);
    expect(pet.getDirty()).toEqual({});

    pet.assign({ counter: 5 });

    expect(pet.isDirty()).toBe(true);
    expect(pet.getDirty()).toEqual({ counter: 5 });
  });
});

describe("dynamic property access (Proxy)", () => {
  it("should allow getting and setting attributes directly on the instance", () => {
    const pet = new Pet({
      name: "Original",
      counter: 1,
      type: "dog",
    });

    // testing dynamic access
    expect(pet.name).toBe("Original");
    expect(pet.counter).toBe(1);
    expect(pet.type).toBe("dog");

    // testing dynamic set
    pet.name = "Spot";
    expect(pet.attributes.name).toBe("Spot");
    expect(pet.name).toBe("Spot");

    pet.counter = 42;
    expect(pet.attributes.counter).toBe(42);
    expect(pet.counter).toBe(42);
  });
});

describe("hydration", () => {
  it("should hydrate a model from database results", async () => {
    const result = await Pet.where("id", "=", 3).first();

    expectToBeDefined(result);

    const pet = new Pet(result.attributes);

    expect(pet.attributes.id).toBe(result.attributes.id);
    expect(pet.attributes.name).toBe(result.attributes.name);
    expect(pet.attributes.counter).toBe(result.attributes.counter);
    expect(pet.attributes.type).toBe(result.attributes.type);
  });
});

describe("query", () => {
  it("should return a query builder", () => {
    const query = Pet.query();
    expect(query).toBeInstanceOf(Builder<Pet>);
  });

  it("should find a model using a where clause", async () => {
    const result = await Pet.where("name", "Zuko").get();
    expect(result).toHaveLength(1);
    expect(result[0].attributes.name).toBe("Zuko");
  });

  it("should default to equals when where is called with field and value", async () => {
    const result = await Person.where("name", "David").first();

    expectToBeDefined(result);
    expect(result?.attributes.name).toBe("David");
  });

  it("should use IN when where is called with field and array", async () => {
    const result = await Person.where("favorite_color", ["blue", "green"]).orderBy("id", "asc").get();

    expect(result).toHaveLength(2);
    expect(result.map((person) => person.attributes.name)).toEqual(["David", "Kate"]);
  });

  it("should select using expressions", async () => {
    const result = await Pet.select((eb) => [eb.fn("upper", ["name"]).as("upper_name")])
      .where("name", "Zuko")
      .executeTakeFirst();

    expectToBeDefined(result);
    const name = result.upper_name; // should have type string
    if (!result) return;
    expect(result.attributes.upper_name).toBe("ZUKO");
    // expect(result.upper_name).toBe("ZUKO");
  });

  it("should select using expression builder callback", async () => {
    const result = await Pet.select((eb) => [
      "name",
      eb.fn("upper", ["name"]).as("upper_name_cb"),
      eb.val("constant").as("constant_cb"),
    ])
      .where("name", "Zuko")
      .executeTakeFirst();

    expectToBeDefined(result);

    // @ts-expect-error - Counter should not be defined, even though it's a default attribute
    expect(result.counter).toBeUndefined();
    // @ts-expect-error - Type should not be defined
    expect(result.type).toBeUndefined();
    // @ts-expect-error - Type should not be defined
    expect(result.attributes.type).toBeUndefined();
    expect(result.attributes.upper_name_cb).toBe("ZUKO");
    expect(result.upper_name_cb).toBe("ZUKO");
  });

  it("should support where with expressions", async () => {
    const result = await Pet.where((eb) => eb.fn("upper", ["name"]), "=", "ZUKO").executeTakeFirst();

    expectToBeDefined(result);
    // expect(result.counter).toBe(0);
    expect(result.type).toBe("bird");
    expect(result.attributes.name).toBe("Zuko");
    expect(result.name).toBe("Zuko");
  });

  it("should find a model using a select clause", async () => {
    // Tests array input
    const result = await Pet.select(["name"]).where("name", "=", "Zuko").executeTakeFirst();
    expectToBeDefined(result);
    expect(result.attributes.name).toBe("Zuko");
    // expect a type error on id
    // @ts-expect-error
    expect(result.attributes.id).toBeUndefined();

    // @ts-expect-error - Counter should not be defined, even though it's a default attribute
    expect(result.counter).toBeUndefined();
    // @ts-expect-error - Type should not be defined
    expect(result.type).toBeUndefined();
    // @ts-expect-error - Type should not be defined
    expect(result.attributes.type).toBeUndefined();
    result.name = "Zuko2"; // should allow dynamic access to selected column
  });

  it("should find a model by id using find", async () => {
    const person = await Person.find(1);
    expectToBeDefined(person);
  });

  it("should throw an error with findOrFail if record not found", async () => {
    try {
      await Person.findOrFail(999);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Record with primary key 999 not found.");
    }
  });

  it("should throw an error with findOrFail if some records not found", async () => {
    try {
      await Person.findOrFail([1, 999]);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("Expected to find 2 records, but only found 1.");
    }
  });

  it("should support subqueries in where clauses", async () => {
    const davidIdSubquery = db.selectFrom("people").select("id").where("name", "=", "David").limit(1);

    const pets = await Pet.where("person_id", "=", davidIdSubquery).orderBy("id", "asc").get();

    expect(pets).toHaveLength(4);
    expect(pets.map((pet) => pet.attributes.name)).toEqual(["Zuko", "Yoshi", "Rex", "Nova"]);
  });

  it("should support IN subqueries in where clauses", async () => {
    const ownersSubquery = db.selectFrom("people").select("id").where("favorite_color", "in", ["blue", "green"]);

    const pets = await Pet.where("person_id", "in", ownersSubquery).get();

    expect(pets).toHaveLength(8);
    expect(pets.every((pet) => pet.attributes.person_id === 1 || pet.attributes.person_id === 2)).toBe(true);
  });

  it("should find models using whereIn", async () => {
    const people = await Person.whereIn("favorite_color", ["blue", "green"]).orderBy("id", "asc").get();

    expect(people).toHaveLength(2);
    expect(people[0].attributes.name).toBe("David");
    expect(people[1].attributes.name).toBe("Kate");
  });

  it("should support subqueries in whereIn clause", async () => {
    const activeUsersSubquery = db.selectFrom("people").select("id").where("favorite_color", "=", "blue");

    const people = await Person.whereIn("id", activeUsersSubquery).get();
    expect(people).toHaveLength(1);
    expect(people[0].attributes.name).toBe("David");
  });

  it("should support subqueries in whereIn clause", async () => {
    const activeUsersSubquery = db.selectFrom("people").select("id").where("favorite_color", "=", "blue");

    const people = await Person.whereIn("id", activeUsersSubquery).get();
    expect(people).toHaveLength(1);
    expect(people[0].attributes.name).toBe("David");
  });

  it("should support subqueries in whereIn clause with custom Builder support", async () => {
    const activeUsersSubquery = db.selectFrom("people").select("id").where("favorite_color", "=", "blue");

    const people = await Person.whereIn("id", activeUsersSubquery as any).get();
    expect(people).toHaveLength(1);
    expect(people[0].attributes.name).toBe("David");
  });

  it("should find models using whereNotNull", async () => {
    const peopleWithPhone = await Person.whereNotNull("phone").get();

    expect(peopleWithPhone.length).toBeGreaterThan(0);
    // verify Jordan is not in the list (since Jordan doesn't have a phone)
    expect(peopleWithPhone.some((p) => p.attributes.name === "Jordan")).toBe(false);
    // verify David is in the list
    expect(peopleWithPhone.some((p) => p.attributes.name === "David")).toBe(true);
  });

  it("should support expressions in whereIn and orderBy", async () => {
    const people = await Person.whereIn((eb) => eb.fn("lower", ["name"]), ["david", "kate"])
      .orderBy((eb) => eb.fn("lower", ["name"]), "asc")
      .get();
    expect(people).toHaveLength(2);
    expect(people.map((p) => p.attributes.name)).toEqual(["David", "Kate"]);
  });
});

describe("limit and offset", () => {
  it("should limit the number of results", async () => {
    const pets = await Pet.limit(1).get();
    expect(pets).toHaveLength(1);
  });

  it("should offset the results", async () => {
    const allPets = await Pet.query().get();
    const offsetPets = await Pet.offset(1).get();
    expect(offsetPets).toHaveLength(allPets.length - 1);
    expect(offsetPets[0].attributes.id).toBe(allPets[1].attributes.id);
  });

  it("should limit and offset the results", async () => {
    const allPets = await Pet.query().get();
    const pets = await Pet.limit(1).offset(1).get();
    expect(pets).toHaveLength(1);
    expect(pets[0].attributes.id).toBe(allPets[1].attributes.id);
  });
});

describe("paginate", () => {
  it("should paginate the results", async () => {
    const result = await Pet.paginate(1, 1);
    expect(result.data).toHaveLength(1);
    expect(result.total).toBeGreaterThan(1);
    expect(result.perPage).toBe(1);
    expect(result.currentPage).toBe(1);
    expect(result.lastPage).toBe(result.total);
  });

  it("should return the second page", async () => {
    const allPets = await Pet.query().get();
    const result = await Pet.paginate(1, 2);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].attributes.id).toBe(allPets[1].attributes.id);
    expect(result.currentPage).toBe(2);
  });
});

describe("orderBy", () => {
  it("should order the results ascending", async () => {
    const pets = await Pet.orderBy("name", "asc").get();
    expect(pets.length).toBeGreaterThan(1);
    expect(pets[0].attributes.name <= pets[1].attributes.name).toBe(true);
  });

  it("should order the results descending", async () => {
    const pets = await Pet.orderBy("name", "desc").get();
    expect(pets.length).toBeGreaterThan(1);
    expect(pets[0].attributes.name >= pets[1].attributes.name).toBe(true);
  });
});

describe("first and firstOrFail", () => {
  it("should return the first result", async () => {
    const pet = await Pet.orderBy("id", "asc").first();
    expectToBeDefined(pet);
    expect(pet?.attributes.id).toBe(1);
  });

  it("should return undefined if no result", async () => {
    const pet = await Pet.where("id", "=", -999).first();
    expect(pet).toBeUndefined();
  });

  it("should return the first result or fail", async () => {
    const pet = await Pet.orderBy("id", "asc").firstOrFail();
    expectToBeDefined(pet);
    expect(pet.attributes.id).toBe(1);
  });

  it("should throw an error if no result", async () => {
    await expect(Pet.where("id", "=", -999).firstOrFail()).rejects.toThrow("Record not found.");
  });
});

describe("aggregates", () => {
  it("should count the results", async () => {
    const count = await Pet.count();
    expect(count).toBeGreaterThan(0);
  });

  it("should count the results with a where clause", async () => {
    const count = await Pet.where("name", "=", "Zuko").count();
    expect(count).toBe(1);
  });

  it("should sum the results", async () => {
    const sum = await Pet.sum("counter");
    expect(sum).toBeGreaterThanOrEqual(0);
  });

  it("should get the max value", async () => {
    const max = await Pet.max("counter");
    expect(max).toBeGreaterThanOrEqual(0);
  });
});

describe("save", () => {
  it("should insert a new record", async () => {
    const pet = new Pet({ name: "Fluffy", type: "cat", counter: 1 });
    expect(pet.isDirty()).toBe(true);
    expect(pet.getDirty()).toEqual({ name: "Fluffy", type: "cat", counter: 1 });

    await pet.save();

    expect(pet.attributes.id).toBeGreaterThan(0);
    expect(pet.isDirty()).toBe(false);
    expect(pet.getDirty()).toEqual({});

    // Clean up
    await pet.delete();
  });

  it("should increment a pet counter", async () => {
    const pet = await Pet.findOrFail(1);
    const initialCounter = pet.attributes.counter;

    await pet.incrementCounter();

    const updatedPet = await Pet.findOrFail(1);
    expect(updatedPet.attributes.counter).toBe(initialCounter + 1);
  });

  it("should only update dirty attributes", async () => {
    const pet = await Pet.findOrFail(1);
    const id = pet.attributes.id;
    const initialCounter = pet.attributes.counter;
    const externalName = `${pet.attributes.name}-external`;

    await db.updateTable("pets").set({ name: externalName }).where("id", "=", id).execute();

    const newCounter = initialCounter + 1;
    pet.attributes.counter = newCounter;
    expect(pet.isDirty()).toBe(true);
    const dirty = pet.getDirty();
    expect(dirty).toEqual({ counter: newCounter });

    await pet.save();

    const updatedPet = await Pet.findOrFail(id);
    expect(updatedPet.attributes.counter).toBe(initialCounter + 1);
    expect(updatedPet.attributes.name).toBe(externalName);

    await db
      .updateTable("pets")
      .set({
        name: pet.originalAttributes.name,
        counter: initialCounter,
      })
      .where("id", "=", id)
      .execute();
  });

  it("should skip update query when no attributes changed", async () => {
    const pet = await Pet.findOrFail(1);

    resetQueryCount();
    await pet.save();

    expect(getQueryCount()).toBe(0);
  });
});

describe("delete", () => {
  it("should delete a record", async () => {
    const pet = new Pet({ name: "Old Yeller", type: "dog", counter: 1 });
    await pet.save();

    const id = pet.attributes.id;

    await pet.delete();

    const deletedPet = await Pet.find(id);
    expect(deletedPet).toBeUndefined();
  });
});

describe("lifecycle events", () => {
  function createEventedPetModel(eventNames: string[], payloadModels: unknown[]) {
    return class EventedPet extends defineModel({
      db,
      table: "pets",
      attributes: {
        counter: 0,
      },
      events: {
        creating: (model) => {
          eventNames.push("creating");
          payloadModels.push(model);
        },
        created: (model) => {
          eventNames.push("created");
          payloadModels.push(model);
        },
        updating: (model) => {
          eventNames.push("updating");
          payloadModels.push(model);
        },
        updated: (model) => {
          eventNames.push("updated");
          payloadModels.push(model);
        },
        saving: (model) => {
          eventNames.push("saving");
          payloadModels.push(model);
        },
        saved: (model) => {
          eventNames.push("saved");
          payloadModels.push(model);
        },
        deleting: (model) => {
          eventNames.push("deleting");
          payloadModels.push(model);
        },
        deleted: (model) => {
          eventNames.push("deleted");
          payloadModels.push(model);
        },
      },
    }) {};
  }

  it("should dispatch creating/created and saving/saved for new models", async () => {
    const eventNames: string[] = [];
    const payloadModels: unknown[] = [];
    const EventedPet = createEventedPetModel(eventNames, payloadModels);

    const pet = new EventedPet({ name: "Event Cat", type: "cat" });
    await pet.save();

    expect(eventNames).toEqual(["saving", "creating", "created", "saved"]);
    expect(payloadModels.every((model) => model === pet)).toBe(true);

    await db.deleteFrom("pets").where("id", "=", pet.attributes.id).executeTakeFirst();
  });

  it("should dispatch updating/updated and saving/saved for dirty existing models", async () => {
    const eventNames: string[] = [];
    const payloadModels: unknown[] = [];
    const EventedPet = createEventedPetModel(eventNames, payloadModels);

    const pet = await EventedPet.findOrFail(1);
    const originalCounter = pet.attributes.counter;

    pet.attributes.counter = originalCounter + 1;
    await pet.save();

    expect(eventNames).toEqual(["saving", "updating", "updated", "saved"]);
    expect(payloadModels.every((model) => model === pet)).toBe(true);

    await db.updateTable("pets").set({ counter: originalCounter }).where("id", "=", 1).executeTakeFirst();
  });

  it("should dispatch saving/saved for clean existing models", async () => {
    const eventNames: string[] = [];
    const payloadModels: unknown[] = [];
    const EventedPet = createEventedPetModel(eventNames, payloadModels);

    const pet = await EventedPet.findOrFail(1);
    await pet.save();

    expect(eventNames).toEqual(["saving", "saved"]);
    expect(payloadModels).toEqual([pet, pet]);
  });

  it("should dispatch deleting/deleted when deleting a model", async () => {
    const eventNames: string[] = [];
    const payloadModels: unknown[] = [];
    const EventedPet = createEventedPetModel(eventNames, payloadModels);

    const pet = new EventedPet({ name: "Delete Event Dog", type: "dog" });
    await pet.save();

    eventNames.length = 0;
    payloadModels.length = 0;

    await pet.delete();

    expect(eventNames).toEqual(["deleting", "deleted"]);
    expect(payloadModels).toEqual([pet, pet]);
  });

  it("should await async lifecycle events during save", async () => {
    const eventNames: string[] = [];

    const AsyncEventedPet = class extends defineModel({
      db,
      table: "pets",
      attributes: {
        counter: 0,
      },
      events: {
        saving: async () => {
          eventNames.push("saving:start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          eventNames.push("saving:end");
        },
        creating: () => {
          eventNames.push("creating");
        },
        created: () => {
          eventNames.push("created");
        },
        saved: () => {
          eventNames.push("saved");
        },
      },
    }) {};

    const pet = new AsyncEventedPet({ name: "Async Save Cat", type: "cat" });
    await pet.save();

    expect(eventNames).toEqual(["saving:start", "saving:end", "creating", "created", "saved"]);

    await db.deleteFrom("pets").where("id", "=", pet.attributes.id).executeTakeFirst();
  });

  it("should await async lifecycle events during delete", async () => {
    const eventNames: string[] = [];

    const AsyncDeleteEventedPet = class extends defineModel({
      db,
      table: "pets",
      attributes: {
        counter: 0,
      },
      events: {
        deleting: async () => {
          eventNames.push("deleting:start");
          await new Promise((resolve) => setTimeout(resolve, 10));
          eventNames.push("deleting:end");
        },
        deleted: () => {
          eventNames.push("deleted");
        },
      },
    }) {};

    const pet = new AsyncDeleteEventedPet({ name: "Async Delete Dog", type: "dog" });
    await pet.save();

    eventNames.length = 0;
    await pet.delete();

    expect(eventNames).toEqual(["deleting:start", "deleting:end", "deleted"]);
  });
});

describe("relationships", () => {
  it("should find models using a one-to-many relationship", async () => {
    const person = await Person.findOrFail(1);
    const pets = await person.pets;
    expect(pets.length).toBe(4);
    expect(pets[0]).toBeInstanceOf(Pet);
    // check and make sure that dynamic also works on related models
    expect(pets[0].name).toBe(pets[0].attributes.name);
    expect(pets.every((pet) => pet.attributes.person_id === 1)).toBe(true);
  });

  it("should find models using a many-to-one relationship", async () => {
    const pet = await Pet.findOrFail(1);
    expectToBeDefined(pet);

    const owner = await pet.owner;
    expectToBeDefined(owner);
    expect(owner.attributes.id).toBe(1);
    expect(owner.name).toBe(owner.attributes.name);
    expect(owner).toBeInstanceOf(Person);
  });

  it("should return return an empty array for a one-to-many relationship with no related records", async () => {
    const person = await Person.where("name", "=", "Morgan").firstOrFail();

    const pets = await person.pets;
    expect(pets).toHaveLength(0);
  });

  it("should return undefined owner for a pet without a person_id", async () => {
    const pet = await Pet.where("name", "=", "Stray").firstOrFail();

    const owner = await pet.owner;
    expect(owner).toBeUndefined();
  });

  it("should allow chaining limit and offset on relationships", async () => {
    const person = await Person.findOrFail(1);
    // type check that allpets is an array of pet obejcts
    const allPets = await person.pets;
    const pets = await person.pets.limit(1).offset(1).get();
    expect(pets).toHaveLength(1);
    expect(pets[0]).toBeInstanceOf(Pet);
    expect(pets[0].attributes.id).toBe(allPets[1].attributes.id);
  });

  it("should eager load hasMany relations with with()", async () => {
    resetQueryCount();
    const people = await Person.with("pets").orderBy("id", "asc").limit(2).get();

    expect(people).toHaveLength(2);
    expectToBeDefined(people[0].loadedRelations.pets);
    expectToBeDefined(people[1].loadedRelations.pets);
    expect(getQueryCount()).toBe(2);

    const firstPersonPets = await people[0].pets;
    expect(firstPersonPets).toBe(people[0].loadedRelations.pets);
    expect(firstPersonPets.every((pet) => pet.attributes.person_id === people[0].attributes.id)).toBe(true);
    expect(getQueryCount()).toBe(2);
  });

  it("should lazy load hasMany relations with additional constraints", async () => {
    const person = await Person.findOrFail(3);
    const bird = await person.pets.where("type", "bird").first();
    expect(bird).toBeInstanceOf(Pet);
  });

  it("should throw an error and have type errors for invalid eager load constraints", async () => {
    await expect(
      Person.with({
        pets: (query) => {
          // @ts-expect-error type 'dog' is ok for value but 'wrong_field' doesn't exist
          query.where("wrong_field", "dog");
        },
      }).findOrFail(3),
    ).rejects.toThrowError(`column "wrong_field" does not exist`);

    const person = await Person.with({
      pets: (query) => {
        // @ts-expect-error type 'type' expects string but got number
        query.where("type", 123);
      },
    }).findOrFail(3);

    // Postgres doesn't strictly fail the query for string = integer comparison here, it just returns empty
    expect(person.loadedRelations.pets).toHaveLength(0);
  });

  it("should eager load with constraints", async () => {
    const person = await Person.with({
      pets: (query) => {
        // Should compile normally
        query.where("type", "cat");
      },
    }).findOrFail(3);

    expectToBeDefined(person.loadedRelations.pets);
    expect(person.loadedRelations.pets).toHaveLength(1);
    expect(person.loadedRelations.pets[0].attributes.type).toBe("cat");
  });

  it("should eager load belongsTo relations with with()", async () => {
    const pets = await Pet.with("owner").orderBy("id", "asc").limit(2).get();

    expect(pets).toHaveLength(2);
    expectToBeDefined(pets[0].loadedRelations.owner);

    const owner = await pets[0].owner;
    expect(owner).toBe(pets[0].loadedRelations.owner);
    expect(owner?.attributes.id).toBe(pets[0].attributes.person_id);
  });

  it("should find models using a many-to-many relationship", async () => {
    const pet = await Pet.findOrFail(1);
    const vets = await pet.vets;
    expect(vets.length).toBe(2);
    expect(vets[0].attributes.name).toBe("Dr. Smith");
    expect(vets[1].attributes.name).toBe("Dr. Jones");
  });

  it("should eager load belongsToMany relations with with()", async () => {
    resetQueryCount();
    const pets = await Pet.with("vets").orderBy("id", "asc").limit(2).get();

    expect(pets).toHaveLength(2);
    expectToBeDefined(pets[0].loadedRelations.vets);
    expectToBeDefined(pets[1].loadedRelations.vets);
    expect(getQueryCount()).toBe(2);

    const firstPetVets = await pets[0].vets;
    expect(firstPetVets).toBe(pets[0].loadedRelations.vets);
    expect(firstPetVets).toHaveLength(2);
    expect(firstPetVets[0].attributes.name).toBe("Dr. Smith");

    const secondPetVets = await pets[1].vets;
    expect(secondPetVets).toBe(pets[1].loadedRelations.vets);
    expect(secondPetVets).toHaveLength(1);
    expect(secondPetVets[0].attributes.name).toBe("Dr. Smith");

    expect(getQueryCount()).toBe(2);
  });

  it("should eager load both vets and owner using with()", async () => {
    resetQueryCount();
    const pets = await Pet.with("vets", "owner").orderBy("id", "asc").limit(2).get();

    expect(pets).toHaveLength(2);
    expectToBeDefined(pets[0].loadedRelations.vets);
    expectToBeDefined(pets[0].loadedRelations.owner);
    expect(getQueryCount()).toBe(3);

    const firstPetVets = await pets[0].vets;
    expect(firstPetVets).toBe(pets[0].loadedRelations.vets);
    expect(firstPetVets).toHaveLength(2);

    const firstPetOwner = await pets[0].owner;
    expect(firstPetOwner).toBe(pets[0].loadedRelations.owner);
    expect(firstPetOwner?.attributes.id).toBe(pets[0].attributes.person_id);

    expectToBeDefined(pets[1].loadedRelations.vets);
    expectToBeDefined(pets[1].loadedRelations.owner);

    const secondPetVets = await pets[1].vets;
    expect(secondPetVets).toBe(pets[1].loadedRelations.vets);
    expect(secondPetVets).toHaveLength(1);

    const secondPetOwner = await pets[1].owner;
    expect(secondPetOwner).toBe(pets[1].loadedRelations.owner);
    expect(secondPetOwner?.attributes.id).toBe(pets[1].attributes.person_id);

    expect(getQueryCount()).toBe(3);
  });

  it("should throw when eager loading an invalid relation", async () => {
    // @ts-expect-error test invalid relation eager loading
    await expect(Person.with("invalidRelation").get()).rejects.toThrow(
      "Relation 'invalidRelation' is not properly defined or does not return a RelationBuilder.",
    );
  });
});

describe("serialization", () => {
  it("should serialize a model to JSON", async () => {
    const pet = await Pet.findOrFail(1);
    const json = pet.toJSON();

    expectToBeDefined(json);
    expect(json.id).toBe(1);
    expect(json.name).toBe("Zuko");
  });

  it("should hide columns specified in the hidden array", async () => {
    const person = await Person.findOrFail(1);
    const json = person.toJSON();

    expectToBeDefined(json);
    expect(json.id).toBe(1);
    expect(json.name).toBe("David");
    expect(json.secret).toBeUndefined();
    expectToBeDefined(person.attributes.secret);
  });

  it("should serialize loaded relations", async () => {
    const person = await Person.with("pets").findOrFail(1);
    const json = person.toJSON();

    expectToBeDefined(json.pets);
    expect(json.pets).toHaveLength(4);
    expectToBeDefined(json.pets[0].name);
  });

  it("should be used by JSON.stringify", async () => {
    const person = await Person.findOrFail(1);
    const jsonString = JSON.stringify(person);
    const parsed = JSON.parse(jsonString);

    expect(parsed.id).toBe(1);
    expect(parsed.name).toBe("David");
    expect(parsed.secret).toBeUndefined();
  });
});

// custom assertion to make sure the value is defined and help with type narrowing
function expectToBeDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined();
}
