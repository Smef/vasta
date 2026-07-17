/* eslint-disable @typescript-eslint/no-explicit-any */

import { Insertable, Kysely, Selectable, Updateable } from "kysely";
import { RelationBuilder, AnyModelConstructor } from "./Builder.js";
import { StaticForwarder } from "./StaticForwarder.js";
import { getCallerMethodName } from "../util/caller.js";

export type ModelLifecycleEventName =
  | "creating"
  | "created"
  | "updating"
  | "updated"
  | "saving"
  | "saved"
  | "deleting"
  | "deleted";

export type ModelLifecycleEventHandler<M extends Model<any, any, any>> = {
  bivarianceHack(model: M): void | Promise<void>;
}["bivarianceHack"];

export type ModelLifecycleEvents<M extends Model<any, any, any>> = Partial<
  Record<ModelLifecycleEventName, ModelLifecycleEventHandler<M>>
>;

export type Accessor<M> = { bivarianceHack(value: any, model: M): any }["bivarianceHack"];
export type Mutator<M> = { bivarianceHack(value: any, model: M): any }["bivarianceHack"];

export type ModelAccessors<M> = Record<string, Accessor<M>>;
export type ModelMutators<M> = Record<string, Mutator<M>>;

/** Used to write to attributes without going through the attributes proxy (avoids double-applying mutators). */
const RAW_ATTRIBUTES = Symbol.for("Model.rawAttributes");

/**
 * Wraps a model instance so that:
 * - reads/writes on `model.attributes` go through the configured accessors/mutators
 * - unknown top-level properties fall through to the attributes (so `pet.name` works)
 */
function createModelProxy<M extends Model<any, any, any>>(model: M): M {
  return new Proxy(model, {
    get(target, prop, receiver) {
      // Special handling for attributes: wrap in a proxy so reads go through accessors/mutators
      if (prop === "attributes") {
        const rawAttributes = target.attributes;
        return new Proxy(rawAttributes, {
          get(attrTarget, attrProp, attrReceiver) {
            if (target.accessors && typeof attrProp === "string" && attrProp in target.accessors) {
              const accessor = target.accessors[attrProp];
              const rawValue = attrProp in attrTarget ? (attrTarget as any)[attrProp] : undefined;
              return accessor(rawValue as any, target);
            }
            return Reflect.get(attrTarget, attrProp, attrReceiver);
          },
          set(attrTarget, attrProp, value, attrReceiver) {
            if (target.mutators && typeof attrProp === "string" && attrProp in target.mutators) {
              const mutator = target.mutators[attrProp];
              const next = mutator(value as any, target);
              (attrTarget as any)[attrProp] = next;
              return true;
            }
            return Reflect.set(attrTarget, attrProp, value, attrReceiver);
          },
        });
      }

      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      if (target.accessors && typeof prop === "string" && prop in target.accessors) {
        const accessor = target.accessors[prop];
        const rawValue = target.attributes && prop in target.attributes ? (target.attributes as any)[prop] : undefined;
        return accessor(rawValue as any, target);
      }

      if (target.attributes && typeof prop === "string" && prop in target.attributes) {
        return target.attributes[prop as keyof typeof target.attributes];
      }
      return undefined;
    },
    set(target, prop, value, receiver) {
      if (prop in target) {
        return Reflect.set(target, prop, value, receiver);
      }

      if (target.mutators && typeof prop === "string" && prop in target.mutators) {
        const mutator = target.mutators[prop];
        const next = mutator(value as any, target);
        target.attributes[prop as keyof typeof target.attributes] = next as any;
        return true;
      }

      if (target.attributes && typeof prop === "string") {
        target.attributes[prop as keyof typeof target.attributes] = value as any;
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    },
  });
}

export abstract class Model<
  DB,
  TB extends keyof DB & string,
  PK extends keyof DB[TB] & string = keyof DB[TB] & string,
> extends StaticForwarder {
  abstract db: Kysely<DB>;
  abstract table: TB;
  abstract primaryKey: PK;
  hidden: (keyof DB[TB] & string)[] = [];
  events: ModelLifecycleEvents<Model<DB, TB, PK>> = {};
  accessors: ModelAccessors<Model<DB, TB, PK>> = {};
  mutators: ModelMutators<Model<DB, TB, PK>> = {};

  get defaultAttributes(): DefaultAttributes<Insertable<DB[TB]>> {
    return {};
  }

  attributes: Selectable<DB[TB]>;
  originalAttributes: Selectable<DB[TB]>;
  exists = false;
  loadedRelations: Record<string, any> = {};

  /**
   * Connection override (e.g. a transaction) used instead of the configured db.
   * Set automatically on models loaded through a connection-bound query, so
   * save, delete, and relations stay on the same connection.
   * Initialized explicitly so the property exists on the instance for the attributes proxy.
   */
  connection: Kysely<DB> | undefined = undefined;

  constructor(attributes: Partial<Insertable<DB[TB]>> = {}, isNew = true) {
    super();

    if (isNew) {
      const defaults = this.defaultAttributes;
      const evaluatedDefaults: Record<string, any> = {};

      for (const [key, value] of Object.entries(defaults)) {
        evaluatedDefaults[key] = typeof value === "function" ? (value as any)() : value;
      }

      this.attributes = { ...evaluatedDefaults, ...attributes } as unknown as Selectable<DB[TB]>;
    } else {
      this.attributes = attributes as unknown as Selectable<DB[TB]>;
    }

    this.originalAttributes = { ...this.attributes };
    (this as any)[RAW_ATTRIBUTES] = this.attributes;

    return createModelProxy(this);
  }

  /**
   * Sets the connection (e.g. a transaction) used for save, delete, and relations
   * instead of the model's configured db. Pass undefined to restore the default.
   */
  useConnection(connection: Kysely<DB> | undefined): this {
    this.connection = connection;
    return this;
  }

  assign(attributes: Partial<Updateable<DB[TB]>>): this {
    this.setRawAttributes(attributes);
    this.applyMutators(Object.keys(attributes));
    return this;
  }

  /** Runs the configured mutators for the given keys against the raw attributes. */
  protected applyMutators(keys: string[]): void {
    const current = this.getRawAttributes() as Record<string, any>;
    const updates: Record<string, any> = {};
    for (const key of keys) {
      if (key in this.mutators) {
        updates[key] = this.mutators[key](current[key], this);
      }
    }
    if (Object.keys(updates).length > 0) this.setRawAttributes(updates);
  }

  /**
   * Returns a shallow copy of the stored attributes without applying accessors.
   * Use when you need the raw persisted values (e.g. for debugging or bypassing get).
   */
  getRawAttributes(): Selectable<DB[TB]> {
    const raw = (this as any)[RAW_ATTRIBUTES] as Record<string, unknown> | undefined;
    const source = raw ?? (this.attributes as Record<string, unknown>);
    return { ...source } as Selectable<DB[TB]>;
  }

  /**
   * Sets attributes directly on the model without applying mutators.
   * Use when you need to write persisted values as-is (e.g. after loading from DB).
   * Accepts both Insertable and Updateable so assign() and direct callers can pass their payloads.
   */
  setRawAttributes(attributes: Partial<Updateable<DB[TB]>> | Partial<Insertable<DB[TB]>>): this {
    const raw = (this as any)[RAW_ATTRIBUTES] as Record<string, any> | undefined;
    if (raw) {
      Object.assign(raw, attributes);
    } else {
      this.attributes = { ...this.attributes, ...attributes } as unknown as Selectable<DB[TB]>;
    }
    return this;
  }

  toJSON(): Record<string, any> {
    const serialized: Record<string, any> = { ...this.attributes };
    for (const key of this.hidden) {
      delete serialized[key];
    }
    for (const [key, relation] of Object.entries(this.loadedRelations)) {
      if (Array.isArray(relation)) {
        serialized[key] = relation.map((r) => (typeof r?.toJSON === "function" ? r.toJSON() : r));
      } else if (relation && typeof relation.toJSON === "function") {
        serialized[key] = relation.toJSON();
      } else {
        serialized[key] = relation;
      }
    }
    return serialized;
  }

  // --- Active Record Methods ---

  getDirty(): Partial<Updateable<DB[TB]>> {
    if (!this.exists) {
      return { ...(this.attributes as unknown as Partial<Updateable<DB[TB]>>) };
    }

    const current = this.attributes as Record<string, unknown>;
    const original = this.originalAttributes as Record<string, unknown>;
    const dirty: Record<string, unknown> = {};

    for (const key of new Set([...Object.keys(current), ...Object.keys(original)])) {
      if (current[key] !== original[key]) {
        dirty[key] = current[key];
      }
    }

    return dirty as Partial<Updateable<DB[TB]>>;
  }

  isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0;
  }

  async dispatchEvent(eventName: ModelLifecycleEventName): Promise<void> {
    await this.events[eventName]?.(this);
  }

  async save(connection?: Kysely<DB>): Promise<this> {
    const db = connection ?? this.db;
    const pkValue = this.attributes[this.primaryKey as unknown as keyof typeof this.attributes];
    const isNewModel = !this.exists;

    await this.dispatchEvent("saving");

    if (isNewModel) {
      await this.dispatchEvent("creating");
    }

    if (this.exists) {
      const dirtyAttributes = this.getDirty();
      const isUpdating = Object.keys(dirtyAttributes).length > 0;

      if (isUpdating) {
        await this.dispatchEvent("updating");
      }

      if (!isUpdating) {
        await this.dispatchEvent("saved");
        return this;
      }

      // UPDATE
      const query = (db as any)
        .updateTable(this.table)
        .set(dirtyAttributes as any)
        .where(this.primaryKey as any, "=", pkValue);
      await query.executeTakeFirst();

      // After successful update, sync originalAttributes with current attributes so we know if anything changes in the future
      this.originalAttributes = { ...this.attributes };
      await this.dispatchEvent("updated");
    } else {
      // INSERT
      const result = await (db as any)
        .insertInto(this.table)
        .values(this.getRawAttributes() as any)
        .returningAll()
        .executeTakeFirst();

      if (result) {
        this.attributes = result as any;
        (this as any)[RAW_ATTRIBUTES] = result;
        this.originalAttributes = { ...this.attributes };
        this.exists = true;
        await this.dispatchEvent("created");
      }
    }

    await this.dispatchEvent("saved");
    return this;
  }

  async delete(connection?: Kysely<DB>): Promise<boolean> {
    if (!this.exists) {
      throw new Error("Cannot delete a model that doesn't exist in the database");
    }

    const db = connection ?? this.db;

    await this.dispatchEvent("deleting");

    const pkValue = this.attributes[this.primaryKey as unknown as keyof typeof this.attributes];
    const result = await (db as any)
      .deleteFrom(this.table)
      .where(this.primaryKey as any, "=", pkValue)
      .executeTakeFirst();

    if (result.numDeletedRows > 0n) {
      this.exists = false;
      await this.dispatchEvent("deleted");
      return true;
    }
    return false;
  }

  /**
   * Defines a one-to-one or many-to-one relationship.
   * e.g., A Pet belongs to a Person.
   */
  belongsTo<R extends AnyModelConstructor>(
    relatedClass: R,
    foreignKey: keyof DB[TB] & string,
    ownerKey: keyof InstanceType<R>["attributes"] & string = "id" as any,
    relationName?: string, // Optional cache key override
  ): RelationBuilder<InstanceType<R>, InstanceType<R> | undefined> {
    const fkValue = this.attributes[foreignKey as unknown as keyof Selectable<DB[TB]>];
    const cacheKey = relationName || getCallerMethodName() || relatedClass.name;

    const builder = new RelationBuilder<InstanceType<R>, InstanceType<R> | undefined>(
      relatedClass,
      (b) => b.first() as any, // Resolves to a single model
      cacheKey,
      this,
      {
        type: "belongsTo",
        relatedClass,
        matchThisKey: foreignKey as string,
        matchRelatedKey: ownerKey,
        relationName: cacheKey,
      },
    );

    builder.where(ownerKey as any, "=", fkValue as any);
    return builder._markClean();
  }

  /**
   * Defines a one-to-one relationship where the related table holds the foreign key.
   * e.g., A Person has one Passport.
   */
  hasOne<R extends AnyModelConstructor>(
    relatedClass: R,
    foreignKey: keyof InstanceType<R>["attributes"] & string, // The column on the related table
    localKey?: keyof DB[TB] & string,
    relationName?: string,
  ): RelationBuilder<InstanceType<R>, InstanceType<R> | undefined> {
    const lKey = localKey || (this.primaryKey as string);
    const localValue = this.attributes[lKey as keyof typeof this.attributes];
    const cacheKey = relationName || getCallerMethodName() || relatedClass.name;

    const builder = new RelationBuilder<InstanceType<R>, InstanceType<R> | undefined>(
      relatedClass,
      (b) => b.first() as any, // Resolves to a single model
      cacheKey,
      this,
      {
        type: "hasOne",
        relatedClass,
        matchThisKey: lKey as string,
        matchRelatedKey: foreignKey,
        relationName: cacheKey,
      },
    );

    builder.where(foreignKey as any, "=", localValue as any);
    return builder._markClean();
  }

  /**
   * Defines a one-to-many relationship.
   * e.g., A Person has many Pets.
   */
  hasMany<R extends AnyModelConstructor>(
    relatedClass: R,
    foreignKey: keyof InstanceType<R>["attributes"] & string, // The column on the related table
    localKey?: keyof DB[TB] & string,
    relationName?: string,
  ): RelationBuilder<InstanceType<R>, InstanceType<R>[]> {
    const lKey = localKey || (this.primaryKey as string);
    const localValue = this.attributes[lKey as keyof typeof this.attributes];
    const cacheKey = relationName || getCallerMethodName() || relatedClass.name + "_many";

    const builder = new RelationBuilder<InstanceType<R>, InstanceType<R>[]>(
      relatedClass,
      (b) => b.get() as any, // Resolves to an array
      cacheKey,
      this,
      {
        type: "hasMany",
        relatedClass,
        matchThisKey: lKey as string,
        matchRelatedKey: foreignKey,
        relationName: cacheKey,
      },
    );

    builder.where(foreignKey as any, "=", localValue as any);
    return builder._markClean();
  }

  /**
   * Defines a many-to-many relationship.
   */
  belongsToMany<R extends AnyModelConstructor, P extends keyof DB & string>(
    relatedClass: R,
    pivotTable: P,
    foreignPivotKey: keyof DB[P] & string,
    relatedPivotKey: keyof DB[P] & string,
    parentKey?: keyof DB[TB] & string,
    relatedKey?: keyof InstanceType<R>["attributes"] & string,
    relationName?: string,
  ): RelationBuilder<InstanceType<R>, InstanceType<R>[]> {
    const parentK = parentKey || (this.primaryKey as string);
    const relatedK = relatedKey || "id";
    const localValue = this.attributes[parentK as keyof typeof this.attributes];
    const cacheKey = relationName || getCallerMethodName() || relatedClass.name + "_many";

    const builder = new RelationBuilder<InstanceType<R>, InstanceType<R>[]>(
      relatedClass,
      (b) => b.get() as any, // Resolves to an array
      cacheKey,
      this,
      {
        type: "belongsToMany",
        relatedClass,
        matchThisKey: parentK as string,
        matchRelatedKey: relatedK,
        relationName: cacheKey,
        pivotTable,
        foreignPivotKey,
        relatedPivotKey,
      },
    );

    const dummy = new (relatedClass as any)({});
    const table = dummy.table;

    // Join the pivot table and filter by the local value
    builder
      .innerJoin(pivotTable, `${pivotTable}.${relatedPivotKey}`, `${table}.${relatedK}`)
      .where(`${pivotTable}.${foreignPivotKey}` as any, "=", localValue as any)
      .selectAll(table)
      .select([`${pivotTable}.${foreignPivotKey} as _pivot_foreign_key` as any]);

    return builder._markClean() as unknown as RelationBuilder<InstanceType<R>, InstanceType<R>[]>;
  }
}

export type DefaultAttributes<T> = { [K in keyof T]?: T[K] | (() => T[K]) };
