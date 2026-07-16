/* eslint-disable @typescript-eslint/no-explicit-any */

import { Insertable, Kysely, Selectable } from "kysely";
import { DefaultAttributes, Model, ModelLifecycleEvents } from "./Model.js";

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

/** Constructor arguments for a defined model: attributes with a configured default become optional. */
export type ModelConstructorArgs<T, DA> = Simplify<Omit<T, keyof DA> & Partial<Pick<T, keyof DA & keyof T>>>;

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

/** Distinguishes an AttributeConfig object from a bare default value in the attributes config. */
function isAttributeConfig(value: unknown): value is AttributeConfig<any, any> {
  return (
    value !== null &&
    typeof value === "object" &&
    ("get" in value || "set" in value || "default" in value || "hidden" in value)
  );
}

/** Table attributes get precise types from T; extra keys (virtual attrs) are unconstrained. */
export type ModelAttributesConfig<M, T extends Record<string, unknown>> = {
  [K in keyof T]?: AttributeConfig<T[K], M> | T[K] | (() => T[K]);
} & Record<string, unknown>;

/** Configuration accepted by defineModel. */
export interface ModelConfig<
  DB,
  TB extends keyof DB & string,
  PK extends keyof DB[TB] & string = keyof DB[TB] & string,
  DA = Record<never, never>,
> {
  db: Kysely<DB>;
  table: TB;
  /** The primary key column. Defaults to "id". */
  primaryKey?: PK;
  events?: ModelLifecycleEvents<Model<DB, TB, PK>>;
  /**
   * Attribute configuration: defaults, accessors (get), mutators (set), and hidden flags.
   * Typed explicitly so object literals get contextual typing and get/set callbacks are
   * properly inferred. DA further narrows this type.
   */
  attributes?: ModelAttributesConfig<Model<DB, TB, PK>, Selectable<DB[TB]>> & DA;
}

export type DefaultPrimaryKey<DB, TB extends keyof DB & string> =
  Extract<"id", keyof DB[TB] & string> extends never ? keyof DB[TB] & string : Extract<"id", keyof DB[TB] & string>;

/** Utility type to require that certain attributes have been selected when defining a function on a model. */
export type RequireSelected<
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

/**
 * The class returned by defineModel: an abstract constructor producing instances that are
 * the Model API merged with the row's selected attributes, plus every static query method
 * inherited from Model / StaticForwarder.
 *
 * This must stay an explicit named type. If defineModel's return type is left to inference,
 * declaration emit serializes the anonymous class structurally, which produces
 * non-portable deep imports into kysely/dist and collapses self-referencing methods
 * (save, assign, ...) to `any` in the published .d.ts.
 */
export type ModelClass<
  DB,
  TB extends keyof DB & string,
  PK extends keyof DB[TB] & string,
  DefaultedInsertable = Record<never, never>,
> = (abstract new (
  attributes: ModelConstructorArgs<Insertable<DB[TB]>, DefaultedInsertable>,
) => DefinedModel<DB, TB, PK> & Selectable<DB[TB]>) & {
  [K in keyof typeof Model]: (typeof Model)[K];
};

/**
 * Instance side of a class produced by defineModel. Redeclares the abstract members
 * (db, table, primaryKey) as concrete because defineModel's config implements them —
 * subclasses of the returned class must not be forced to re-implement them.
 */
export interface DefinedModel<DB, TB extends keyof DB & string, PK extends keyof DB[TB] & string> extends Model<
  DB,
  TB,
  PK
> {
  db: Kysely<DB>;
  table: TB;
  primaryKey: PK;
}

export function defineModel<
  DB,
  TB extends keyof DB & string,
  PK extends keyof DB[TB] & string = DefaultPrimaryKey<DB, TB>,
  // DA is the *narrow* attributes config type, used to detect which attributes have defaults
  DA extends Partial<ModelAttributesConfig<Model<DB, TB, PK>, Selectable<DB[TB]>>> = Record<never, never>,
>(
  config: ModelConfig<DB, TB, PK, DA>,
): ModelClass<DB, TB, PK, Pick<Insertable<DB[TB]>, Extract<DefaultedAttributeKeys<DA>, keyof Insertable<DB[TB]>>>> {
  // Derive the subset of Insertable<DB[TB]> that have defaults defined in DA.
  type DefaultedInsertableKeys = Extract<DefaultedAttributeKeys<DA>, keyof Insertable<DB[TB]>>;
  type DefaultedInsertable = Pick<Insertable<DB[TB]>, DefaultedInsertableKeys>;

  abstract class BaseModel extends Model<DB, TB, PK> {
    db = config.db;
    table = config.table;
    // Fallback to "id" if not provided, explicitly cast to keep TypeScript happy
    primaryKey = (config.primaryKey ?? "id") as PK;
    hidden = Object.entries(config.attributes ?? {})
      .filter(([, value]) => isAttributeConfig(value) && value.hidden)
      .map(([key]) => key as keyof DB[TB] & string);
    events = (config.events ?? {}) as ModelLifecycleEvents<Model<DB, TB, PK>>;

    // Parse attributes config to separate defaults, accessors, and mutators
    constructor(attributes: ModelConstructorArgs<Insertable<DB[TB]>, DefaultedInsertable>, isNew = true) {
      super(attributes as any, isNew);

      // Initialize accessors and mutators based on config.attributes
      for (const [key, attr] of Object.entries(config.attributes ?? {})) {
        if (isAttributeConfig(attr)) {
          if (typeof attr.get === "function") this.accessors[key] = attr.get;
          if (typeof attr.set === "function") this.mutators[key] = attr.set;
        }
      }

      // Apply mutators for initial attributes if it's a new model. applyMutators uses
      // setRawAttributes so we don't go through the attributes proxy set trap (which
      // would apply the mutator again when this is the proxy).
      if (isNew) {
        this.applyMutators(Object.keys(this.getRawAttributes()));
      }
    }

    get defaultAttributes(): DefaultAttributes<Insertable<DB[TB]>> {
      const defaults: Record<string, any> = {};
      for (const [key, value] of Object.entries(config.attributes ?? {})) {
        if (!isAttributeConfig(value)) {
          // A bare value (or factory) is shorthand for { default: value }
          defaults[key] = value;
        } else if (value.default !== undefined) {
          defaults[key] = typeof value.default === "function" ? value.default() : value.default;
        }
      }
      return defaults as DefaultAttributes<Insertable<DB[TB]>>;
    }
  }

  return BaseModel as unknown as ModelClass<DB, TB, PK, DefaultedInsertable>;
}
