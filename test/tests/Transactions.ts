import { describe, it, expect } from "vitest";

import Pet from "@/database/models/Pet";
import Person from "@/database/models/Person";
import db from "@/database/db";

describe("transactions", () => {
  it("commits model activity when the callback resolves", async () => {
    await db.transaction().execute(async (trx) => {
      await Pet.create({ name: "TrxCommit", type: "cat" }, trx);
    });

    const pet = await Pet.where("name", "TrxCommit").first();
    expect(pet).toBeDefined();
    await pet?.delete();
  });

  it("rolls back created models when the callback throws", async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await Pet.create({ name: "TrxRollback", type: "cat" }, trx);

        // The insert is visible inside the transaction
        const inside = await Pet.query(trx).where("name", "TrxRollback").first();
        expect(inside).toBeDefined();

        // ...but not outside of it
        const outside = await Pet.where("name", "TrxRollback").first();
        expect(outside).toBeUndefined();

        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    const pet = await Pet.where("name", "TrxRollback").first();
    expect(pet).toBeUndefined();
  });

  it("runs save and delete on a connection passed directly", async () => {
    const existing = await Pet.create({ name: "TrxVictim", type: "dog" });

    await expect(
      db.transaction().execute(async (trx) => {
        existing.attributes.name = "TrxVictimRenamed";
        await existing.save(trx);

        const fresh = new Pet({ name: "TrxFresh", type: "cat" });
        await fresh.save(trx);

        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Pet.where("name", "TrxVictim").first()).toBeDefined();
    expect(await Pet.where("name", "TrxVictimRenamed").first()).toBeUndefined();
    expect(await Pet.where("name", "TrxFresh").first()).toBeUndefined();

    await existing.delete();
  });

  it("keeps models loaded through a transaction on that transaction", async () => {
    const victim = await Pet.create({ name: "TrxSticky", type: "dog" });

    await expect(
      db.transaction().execute(async (trx) => {
        const pet = await Pet.query(trx).where("name", "TrxSticky").firstOrFail();

        // The model remembers the connection it was loaded through
        pet.attributes.name = "TrxStickyRenamed";
        await pet.save();
        await pet.delete();

        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    // Both the rename and the delete were rolled back
    expect(await Pet.where("name", "TrxSticky").first()).toBeDefined();

    await victim.delete();
  });

  it("binds a connection to a new model with useConnection", async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        const pet = new Pet({ name: "TrxUseConnection", type: "cat" });
        await pet.useConnection(trx).save();
        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Pet.where("name", "TrxUseConnection").first()).toBeUndefined();
  });

  it("rolls back createMany", async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await Pet.create(
          [
            { name: "TrxBulk1", type: "cat" },
            { name: "TrxBulk2", type: "cat" },
          ],
          trx,
        );
        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Pet.where("name", "TrxBulk1").first()).toBeUndefined();
    expect(await Pet.where("name", "TrxBulk2").first()).toBeUndefined();
  });

  it("runs relations and eager loads on the parent model's connection", async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        const person = await Person.create({ name: "TrxOwner", birthday: new Date("2000-01-01") }, trx);
        await Pet.create({ name: "TrxOwned", type: "cat", person_id: person.id }, trx);

        // Lazy relation on a trx-bound model sees the uncommitted pet
        const pets = await person.pets;
        expect(pets).toHaveLength(1);
        expect(pets[0].attributes.name).toBe("TrxOwned");

        // Eager loading through the transaction sees it too
        const reloaded = await Person.query(trx).with("pets").where("name", "TrxOwner").firstOrFail();
        expect(reloaded.loadedRelations.pets).toHaveLength(1);

        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Person.where("name", "TrxOwner").first()).toBeUndefined();
    expect(await Pet.where("name", "TrxOwned").first()).toBeUndefined();
  });

  it("supports useConnection on the query builder", async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await Pet.create({ name: "TrxBuilder", type: "cat" }, trx);

        const found = await Pet.query().useConnection(trx).where("name", "TrxBuilder").first();
        expect(found).toBeDefined();

        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Pet.where("name", "TrxBuilder").first()).toBeUndefined();
  });

  it("rolls back destroy through a transaction-bound query", async () => {
    const pet = await Pet.create({ name: "TrxDestroy", type: "dog" });

    await expect(
      db.transaction().execute(async (trx) => {
        const destroyed = await Pet.query(trx).destroy(pet.id);
        expect(destroyed).toBe(1);
        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Pet.where("name", "TrxDestroy").first()).toBeDefined();
    await pet.delete();
  });

  it("supports the static Model.transaction() shorthand", async () => {
    await expect(
      Pet.transaction(async (trx) => {
        await Pet.create({ name: "TrxStatic", type: "cat" }, trx);
        await Person.create({ name: "TrxStaticPerson", birthday: new Date("2000-01-01") }, trx);
        throw new Error("abort");
      }),
    ).rejects.toThrowError("abort");

    expect(await Pet.where("name", "TrxStatic").first()).toBeUndefined();
    expect(await Person.where("name", "TrxStaticPerson").first()).toBeUndefined();
  });

  it("keeps concurrent transactions isolated", async () => {
    const commit = db.transaction().execute(async (trx) => {
      await Pet.create({ name: "TrxConcurrentCommit", type: "cat" }, trx);
    });

    const rollback = db.transaction().execute(async (trx) => {
      await Pet.create({ name: "TrxConcurrentRollback", type: "cat" }, trx);
      throw new Error("abort");
    });

    await expect(Promise.allSettled([commit, rollback])).resolves.toMatchObject([
      { status: "fulfilled" },
      { status: "rejected" },
    ]);

    const committed = await Pet.where("name", "TrxConcurrentCommit").first();
    expect(committed).toBeDefined();
    expect(await Pet.where("name", "TrxConcurrentRollback").first()).toBeUndefined();

    await committed?.delete();
  });
});
