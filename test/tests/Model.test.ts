import { describe, it, expect, beforeAll, afterAll } from "vitest";

import Pet from "@/database/models/Pet";
import Person from "@/database/models/Person";
import { getQueryCount, resetQueryCount } from "@/database/db";
import db from "@/database/db";
import { Builder } from "@src/Eloquent/Builder";

describe("Model", () => {
  describe("find", () => {
    it("should find a record by id", async () => {
      const pet = await Pet.find(1);
      expect(pet).not.toBeNull();
      if (!pet) return;

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
      expect(pets).not.toBeUndefined();
      if (!pets) return;
      expect(pets[0].attributes.id).toBe(2);
      expect(pets[1].attributes.id).toBe(4);
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
      const result = await Pet.where("name", "=", "Zuko").get();
      expect(result).toHaveLength(1);
      expect(result[0].attributes.name).toBe("Zuko");
    });

    it("should default to equals when where is called with field and value", async () => {
      const result = await Person.where("name", "David").first();

      expect(result).toBeDefined();
      expect(result?.attributes.name).toBe("David");
    });

    it("should use IN when where is called with field and array", async () => {
      const result = await Person.where("favorite_color", ["blue", "green"]).orderBy("id", "asc").get();

      expect(result).toHaveLength(2);
      expect(result.map((person) => person.attributes.name)).toEqual(["David", "Kate"]);
    });

    it("should find a model using a select clause", async () => {
      const result = await Pet.select("name").where("name", "=", "Zuko").executeTakeFirst();
      expect(result).toBeDefined();
      if (!result) return;
      expect(result.attributes.name).toBe("Zuko");
      // expect a type error on id
      // @ts-expect-error
      expect(result.attributes.id).toBeUndefined();
    });

    it("should find a model by id using find", async () => {
      const person = await Person.find(1);
      expect(person).not.toBeNull();
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

    it("should support scalar subqueries in where clauses", async () => {
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
      expect(pet).toBeDefined();
      expect(pet?.attributes.id).toBe(1);
    });

    it("should return undefined if no result", async () => {
      const pet = await Pet.where("id", "=", -999).first();
      expect(pet).toBeUndefined();
    });

    it("should return the first result or fail", async () => {
      const pet = await Pet.orderBy("id", "asc").firstOrFail();
      expect(pet).toBeDefined();
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
      await pet.save();
      expect(pet.attributes.id).toBeGreaterThan(0);

      // Clean up
      await pet.delete();
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

  describe("relationships", () => {
    it("should find models using a one-to-many relationship", async () => {
      const person = await Person.findOrFail(1);
      const pets = await person.pets;
      expect(pets.length).toBe(4);
      expect(pets[0]).toBeInstanceOf(Pet);
      expect(pets.every((pet) => pet.attributes.person_id === 1)).toBe(true);
    });

    it("should find models using a many-to-one relationship", async () => {
      const pet = await Pet.findOrFail(1);
      expect(pet).not.toBeNull();

      const owner = await pet.owner;
      expect(owner).not.toBeNull();
      expect(owner?.attributes.id).toBe(1);
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
      expect(people[0].loadedRelations.pets).toBeDefined();
      expect(people[1].loadedRelations.pets).toBeDefined();
      expect(getQueryCount()).toBe(2);

      const firstPersonPets = await people[0].pets;
      expect(firstPersonPets).toBe(people[0].loadedRelations.pets);
      expect(firstPersonPets.every((pet) => pet.attributes.person_id === people[0].attributes.id)).toBe(true);
      expect(getQueryCount()).toBe(2);
    });

    it("should eager load belongsTo relations with with()", async () => {
      const pets = await Pet.with("owner").orderBy("id", "asc").limit(2).get();

      expect(pets).toHaveLength(2);
      expect(pets[0].loadedRelations.owner).toBeDefined();

      const owner = await pets[0].owner;
      expect(owner).toBe(pets[0].loadedRelations.owner);
      expect(owner?.attributes.id).toBe(pets[0].attributes.person_id);
    });

    it("should throw when eager loading an invalid relation", async () => {
      await expect(Person.with("invalidRelation").get()).rejects.toThrow(
        "Relation 'invalidRelation' is not properly defined or does not return a RelationBuilder.",
      );
    });
  });

  // custom assertion to make sure the value is defined and help with type narrowing
  function expectToBeDefined<T>(value: T | undefined): asserts value is T {
    expect(value).toBeDefined();
  }
});
