/* eslint-disable @typescript-eslint/no-explicit-any */

import { Insertable, Kysely, Selectable, Updateable } from "kysely";
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

export type Accessor<M> = { bivarianceHack(value: any, model: M): any }["bivarianceHack"];
export type Mutator<M> = { bivarianceHack(value: any, model: M): any }["bivarianceHack"];

export type ModelAccessors<M> = Record<string, Accessor<M>>;
export type ModelMutators<M> = Record<string, Mutator<M>>;

/** Used to write to attributes without going through the attributes proxy (avoids double-applying mutators). */
const RAW_ATTRIBUTES = Symbol.for("Model.rawAttributes");

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

    return new Proxy(this, {
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
          const rawValue =
            target.attributes && prop in target.attributes ? (target.attributes as any)[prop] : undefined;
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

  assign(attributes: Partial<Updateable<DB[TB]>>): this {
    const raw = (this as any)[RAW_ATTRIBUTES] as Record<string, any> | undefined;
    if (!raw) {
      this.attributes = { ...this.attributes, ...attributes } as unknown as Selectable<DB[TB]>;
      if (this.mutators) {
        for (const key of Object.keys(attributes)) {
          if (key in this.mutators) {
            const mutator = this.mutators[key];
            const incoming = this.attributes[key as keyof typeof this.attributes];
            const next = mutator(incoming as any, this);
            (this.attributes as any)[key] = next;
          }
        }
      }
      return this;
    }
    this.setRawAttributes(attributes);
    if (this.mutators) {
      const current = this.getRawAttributes() as Record<string, any>;
      const updates: Record<string, any> = {};
      for (const key of Object.keys(attributes)) {
        if (key in this.mutators) {
          updates[key] = this.mutators[key](current[key], this);
        }
      }
      if (Object.keys(updates).length > 0) this.setRawAttributes(updates);
    }
    return this;
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

    const dirty: Partial<Updateable<DB[TB]>> = {};
    const keys = new Set([
      ...Object.keys(this.attributes as Record<string, unknown>),
      ...Object.keys(this.originalAttributes as Record<string, unknown>),
    ]);

    for (const key of keys) {
      const typedKey = key as keyof DB[TB] & string;
      const currentValue = this.attributes[typedKey as keyof typeof this.attributes];
      const originalValue = this.originalAttributes[typedKey as keyof typeof this.originalAttributes];

      if (currentValue !== originalValue) {
        dirty[typedKey as keyof Updateable<DB[TB]>] = currentValue as unknown as Updateable<DB[TB]>[keyof Updateable<
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
      const result = await (this.db as any)
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

export type DefaultAttributes<T> = { [K in keyof T]?: T[K] | (() => T[K]) };

export type AttributeConfig<T, M> = {
  default?: T | (() => T);
  /**
   * Accessors receive the original attribute value and can modify it as needed.
   * The return type must match the original type of the attribute as defined in the Kysely type definition.
   */
  get?: (value: T, model: M) => T;
  /**
   * Mutators receive the new attribute value and must return the value to persist.
   * The return type must match the original type of the attribute as defined in the Kysely type definition.
   */
  set?: (value: T, model: M) => T;
  /**
   * When true, this attribute is omitted from JSON serialization.
   */
  hidden?: boolean;
};

/** Table attributes get precise types from T; extra keys (virtual attrs) allow AttributeConfig<any, M> | unknown. */
export type ModelAttributesConfig<M, T extends Record<string, unknown>> = {
  [K in keyof T]?: AttributeConfig<T[K], M> | T[K] | (() => T[K]);
} & Record<string, AttributeConfig<any, M> | unknown>;

export interface ModelConfig<DB, TB extends keyof DB & string> {
  db: Kysely<DB>;
  table: TB;
  // Make primaryKey optional, it will default to "id" under the hood
  primaryKey?: keyof DB[TB] & string;
  attributes?: ModelAttributesConfig<Model<DB, TB, keyof DB[TB] & string>, Selectable<DB[TB]>>;
  events?: ModelLifecycleEvents<Model<DB, TB, keyof DB[TB] & string>>;
}

export type DefaultPrimaryKey<DB, TB extends keyof DB & string> =
  Extract<"id", keyof DB[TB] & string> extends never ? keyof DB[TB] & string : Extract<"id", keyof DB[TB] & string>;

/** Utility type to require that certain attributes have been selected when defining a function on a model. */
export type RequiresSelected<
  M extends { attributes: Record<string, unknown> },
  K extends keyof M["attributes"] & string,
> = Omit<M, "attributes" | (keyof M["attributes"] & string)> & {
  attributes: Pick<M["attributes"], K> & Partial<Omit<M["attributes"], K>>;
} & Pick<M["attributes"], K> &
  Partial<Omit<M["attributes"], K>>;

// Keys in the attributes config that have an explicit default.
type DefaultedAttributeKeys<DA> = {
  [K in keyof DA]: DA[K] extends { default: any } ? K : never;
}[keyof DA];

export function defineModel<
  DB,
  TB extends keyof DB & string,
  PK extends keyof DB[TB] & string = DefaultPrimaryKey<DB, TB>,
  // DA is the *narrow* attributes config type, but attributes are always at least ModelAttributesConfig<...>
  DA extends Partial<ModelAttributesConfig<Model<DB, TB, PK>, Selectable<DB[TB]>>> = Record<never, never>,
>(
  config: Omit<ModelConfig<DB, TB>, "primaryKey" | "events" | "attributes"> & {
    primaryKey?: PK;
    events?: ModelLifecycleEvents<Model<DB, TB, PK>>;
    /**
     * Use explicit type here so object literals get contextual typing and
     * get/set callbacks are properly inferred. DA further narrows this type.
     */
    attributes?: ModelAttributesConfig<Model<DB, TB, PK>, Selectable<DB[TB]>> & DA;
  },
) {
  // Derive the subset of Insertable<DB[TB]> that have defaults defined in DA.
  type DefaultedInsertableKeys = Extract<DefaultedAttributeKeys<DA>, keyof Insertable<DB[TB]>>;
  type DefaultedInsertable = Pick<Insertable<DB[TB]>, DefaultedInsertableKeys>;

  abstract class BaseModel extends Model<DB, TB, PK> {
    db = config.db;
    table = config.table;
    // Fallback to "id" if not provided, explicitly cast to keep TypeScript happy
    primaryKey = (config.primaryKey ?? "id") as PK;
    hidden = (() => {
      const attrHidden: (keyof DB[TB] & string)[] = [];
      if (config.attributes) {
        for (const [key, value] of Object.entries(config.attributes)) {
          const attr = value as AttributeConfig<any, Model<DB, TB, PK>> | undefined;
          if (attr && typeof attr === "object" && "hidden" in attr && attr.hidden) {
            attrHidden.push(key as keyof DB[TB] & string);
          }
        }
      }
      return [...new Set(attrHidden)];
    })();
    events = (config.events ?? {}) as ModelLifecycleEvents<Model<DB, TB, PK>>;

    // Parse attributes config to separate defaults, accessors, and mutators
    constructor(attributes: ModelConstructorArgs<Insertable<DB[TB]>, DefaultedInsertable>, isNew = true) {
      super(attributes as any, isNew);

      // Initialize accessors and mutators based on config.attributes
      if (config.attributes) {
        for (const [key, value] of Object.entries(config.attributes)) {
          const attr = value as AttributeConfig<any, Model<DB, TB, PK>> | undefined;
          if (
            attr &&
            typeof attr === "object" &&
            ("get" in attr || "set" in attr || "default" in attr || "hidden" in attr)
          ) {
            if (typeof attr.get === "function") this.accessors[key] = attr.get;
            if (typeof attr.set === "function") this.mutators[key] = attr.set;
          }
        }
      }

      // Apply mutators for initial attributes if it's a new model. Use setRawAttributes
      // so we don't go through the attributes proxy set trap (which would apply the
      // mutator again when this is the proxy).
      if (isNew && this.mutators) {
        const current = this.getRawAttributes() as Record<string, any>;
        const updates: Record<string, any> = {};
        for (const key of Object.keys(current)) {
          if (key in this.mutators) {
            updates[key] = this.mutators[key](current[key], this);
          }
        }
        if (Object.keys(updates).length > 0) this.setRawAttributes(updates);
      }
    }

    get defaultAttributes(): DefaultAttributes<Insertable<DB[TB]>> {
      const defaults: Record<string, any> = {};
      if (config.attributes) {
        for (const [key, value] of Object.entries(config.attributes)) {
          const attr = value as AttributeConfig<any, Model<DB, TB, PK>> | undefined;
          if (
            attr &&
            typeof attr === "object" &&
            ("get" in attr || "set" in attr || "default" in attr || "hidden" in attr)
          ) {
            if (attr.default !== undefined)
              defaults[key] = typeof attr.default === "function" ? attr.default() : attr.default;
          } else {
            defaults[key] = value;
          }
        }
      }
      return defaults as DefaultAttributes<Insertable<DB[TB]>>;
    }
  }

  return BaseModel as unknown as (abstract new (
    attributes: ModelConstructorArgs<Insertable<DB[TB]>, DefaultedInsertable>,
  ) => BaseModel & Selectable<DB[TB]>) & {
    [K in keyof typeof BaseModel]: (typeof BaseModel)[K];
  };
}
