/* eslint-disable @typescript-eslint/no-explicit-any */

import { Insertable, Kysely, Selectable } from "kysely";
import { RelationBuilder } from "@src/model/Builder";
import { StaticForwarder, type AnyModelConstructor } from "@src/model/StaticForwarder";
import { getCallerMethodName } from "@src/util/caller";

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

  get defaultAttributes(): DefaultAttributes<Insertable<DB[TB]>> {
    return {};
  }

  attributes: Selectable<DB[TB]>;
  originalAttributes: Selectable<DB[TB]>;
  exists = false;
  loadedRelations: Record<string, any> = {};

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

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
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
        if (target.attributes && typeof prop === "string") {
          target.attributes[prop as keyof typeof target.attributes] = value as any;
          return true;
        }
        return Reflect.set(target, prop, value, receiver);
      },
    });
  }

  assign(attributes: Partial<Insertable<DB[TB]>>): this {
    this.attributes = { ...this.attributes, ...attributes } as unknown as Selectable<DB[TB]>;
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

  getDirty(): Partial<Insertable<DB[TB]>> {
    if (!this.exists) {
      return { ...(this.attributes as unknown as Partial<Insertable<DB[TB]>>) };
    }

    const dirty: Partial<Insertable<DB[TB]>> = {};
    const keys = new Set([
      ...Object.keys(this.attributes as Record<string, unknown>),
      ...Object.keys(this.originalAttributes as Record<string, unknown>),
    ]);

    for (const key of keys) {
      const typedKey = key as keyof DB[TB] & string;
      const currentValue = this.attributes[typedKey as keyof typeof this.attributes];
      const originalValue = this.originalAttributes[typedKey as keyof typeof this.originalAttributes];

      if (currentValue !== originalValue) {
        dirty[typedKey as keyof Insertable<DB[TB]>] = currentValue as unknown as Insertable<DB[TB]>[keyof Insertable<
          DB[TB]
        >];
      }
    }

    return dirty;
  }

  isDirty(): boolean {
    return Object.keys(this.getDirty()).length > 0;
  }

  async dispatchEvent(eventName: ModelLifecycleEventName): Promise<void> {
    await this.events[eventName]?.(this);
  }

  async save(): Promise<this> {
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
      const query = (this.db as any)
        .updateTable(this.table)
        .set(dirtyAttributes as any)
        .where(this.primaryKey as any, "=", pkValue);
      await query.executeTakeFirst();

      // After successful update, sync originalAttributes with current attributes so we know if anything changes in the future
      this.originalAttributes = { ...this.attributes };
      await this.dispatchEvent("updated");
    } else {
      // INSERT
      const result = await this.db
        .insertInto(this.table)
        .values(this.attributes as any)
        .returningAll()
        .executeTakeFirst();

      if (result) {
        this.attributes = result as any;
        this.originalAttributes = { ...this.attributes };
        this.exists = true;
        await this.dispatchEvent("created");
      }
    }

    await this.dispatchEvent("saved");
    return this;
  }

  async delete(): Promise<boolean> {
    if (!this.exists) {
      throw new Error("Cannot delete a model that doesn't exist in the database");
    }

    await this.dispatchEvent("deleting");

    const pkValue = this.attributes[this.primaryKey as unknown as keyof typeof this.attributes];
    const result = await (this.db as any)
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

// Model config and function to set up the models and help type inference and intellisense

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type ModelConstructorArgs<T, DA> = Simplify<Omit<T, keyof DA> & Partial<Pick<T, keyof DA & keyof T>>>;

export type DefaultAttributes<T> = {
  [K in keyof T]?: T[K] | (() => T[K]);
};

export interface ModelConfig<DB, TB extends keyof DB & string> {
  db: Kysely<DB>;
  table: TB;
  // Make primaryKey optional, it will default to "id" under the hood
  primaryKey?: keyof DB[TB] & string;
  hidden?: (keyof DB[TB] & string)[];
  attributes?: DefaultAttributes<Insertable<DB[TB]>>;
  events?: ModelLifecycleEvents<Model<DB, TB, keyof DB[TB] & string>>;
}

export type DefaultPrimaryKey<DB, TB extends keyof DB & string> = Extract<"id", keyof DB[TB] & string> extends never
  ? keyof DB[TB] & string
  : Extract<"id", keyof DB[TB] & string>;

export function defineModel<
  DB,
  TB extends keyof DB & string,
  PK extends keyof DB[TB] & string = DefaultPrimaryKey<DB, TB>,
  DA extends DefaultAttributes<Insertable<DB[TB]>> = Record<never, never>,
>(config: Omit<ModelConfig<DB, TB>, "primaryKey" | "events"> & { primaryKey?: PK; events?: ModelLifecycleEvents<Model<DB, TB, PK>>; attributes?: DA }) {
  abstract class BaseModel extends Model<DB, TB, PK> {
    db = config.db;
    table = config.table;
    // Fallback to "id" if not provided, explicitly cast to keep TypeScript happy
    primaryKey = (config.primaryKey ?? "id") as PK;
    hidden = config.hidden ?? [];
    events = (config.events ?? {}) as ModelLifecycleEvents<Model<DB, TB, PK>>;

    get defaultAttributes(): DefaultAttributes<Insertable<DB[TB]>> {
      return (config.attributes ?? {}) as DefaultAttributes<Insertable<DB[TB]>>;
    }

    constructor(attributes: ModelConstructorArgs<Insertable<DB[TB]>, Exclude<DA, undefined>>, isNew = true) {
      super(attributes as any, isNew);
    }
  }

  return BaseModel as unknown as (abstract new (
    attributes: ModelConstructorArgs<Insertable<DB[TB]>, Exclude<DA, undefined>>,
  ) => BaseModel & Selectable<DB[TB]>) & {
    [K in keyof typeof BaseModel]: (typeof BaseModel)[K];
  };
}
