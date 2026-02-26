/* eslint-disable @typescript-eslint/no-explicit-any */

import { Insertable, Kysely, Selectable } from "kysely";
import { Builder, RelationBuilder } from "@src/Eloquent/Builder";

export type AnyModelConstructor = abstract new (...args: any[]) => Model<any, any>;

export abstract class Model<DB, TB extends keyof DB & string> {
  abstract db: Kysely<DB>;
  abstract table: TB;
  abstract primaryKey: keyof DB[TB] & string;

  attributes: Selectable<DB[TB]>;
  exists = false;
  loadedRelations: Record<string, any> = {};

  constructor(attributes: Insertable<DB[TB]>) {
    this.attributes = attributes as unknown as Selectable<DB[TB]>;
  }

  // --- Active Record Methods ---

  async save(): Promise<this> {
    const pkValue = this.attributes[this.primaryKey as keyof typeof this.attributes];

    if (this.exists) {
      // UPDATE
      await this.db
        .updateTable(this.table)
        .set(this.attributes as any)
        .where(this.primaryKey as any, "=", pkValue)
        .executeTakeFirst();
    } else {
      // INSERT
      const result = await this.db
        .insertInto(this.table)
        .values(this.attributes as any)
        .returningAll()
        .executeTakeFirst();

      if (result) {
        this.attributes = result as any;
        this.exists = true;
      }
    }
    return this;
  }

  async delete(): Promise<boolean> {
    if (!this.exists) {
      throw new Error("Cannot delete a model that doesn't exist in the database");
    }

    const pkValue = this.attributes[this.primaryKey as keyof typeof this.attributes];
    const result = await this.db
      .deleteFrom(this.table)
      .where(this.primaryKey as any, "=", pkValue)
      .executeTakeFirst();

    if (result.numDeletedRows > 0n) {
      this.exists = false;
      return true;
    }
    return false;
  }

  // --- Static Pass-Through Methods ---

  static query<T extends AnyModelConstructor>(this: T): Builder<InstanceType<T>> {
    return new Builder(this as any);
  }

  static where<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
    operator: string,
    value: any,
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
    value: any,
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor>(this: T, ...args: any[]): Builder<InstanceType<T>> {
    return (this as any).query().where(...args);
  }

  static whereIn<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
    values: any[],
  ): Builder<InstanceType<T>> {
    return (this as any).query().whereIn(column, values);
  }

  static whereNotNull<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
  ): Builder<InstanceType<T>> {
    return (this as any).query().whereNotNull(column);
  }

  static limit<T extends AnyModelConstructor>(this: T, value: number): Builder<InstanceType<T>> {
    return (this as any).query().limit(value);
  }

  static offset<T extends AnyModelConstructor>(this: T, value: number): Builder<InstanceType<T>> {
    return (this as any).query().offset(value);
  }

  static orderBy<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
    direction: "asc" | "desc" = "asc",
  ): Builder<InstanceType<T>> {
    return (this as any).query().orderBy(column, direction);
  }

  static async first<T extends AnyModelConstructor>(this: T): Promise<InstanceType<T> | undefined> {
    return (this as any).query().first();
  }

  static async firstOrFail<T extends AnyModelConstructor>(this: T): Promise<InstanceType<T>> {
    return (this as any).query().firstOrFail();
  }

  static async count<T extends AnyModelConstructor>(this: T): Promise<number> {
    return (this as any).query().count();
  }

  static async sum<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
  ): Promise<number> {
    return (this as any).query().sum(column);
  }

  static async max<T extends AnyModelConstructor>(
    this: T,
    column: keyof InstanceType<T>["attributes"] & string,
  ): Promise<number | null> {
    return (this as any).query().max(column);
  }

  static async paginate<T extends AnyModelConstructor>(
    this: T,
    perPage?: number,
    page?: number,
  ): Promise<{
    data: InstanceType<T>[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  }> {
    return (this as any).query().paginate(perPage, page);
  }

  /**
   * Static pass-through for find() with overloads
   */
  static async find<T extends AnyModelConstructor>(this: T, id: string | number): Promise<InstanceType<T> | undefined>;

  static async find<T extends AnyModelConstructor>(this: T, ids: (string | number)[]): Promise<InstanceType<T>[]>;

  static async find<T extends AnyModelConstructor>(
    this: T,
    idOrIds: string | number | (string | number)[],
  ): Promise<InstanceType<T> | InstanceType<T>[] | undefined> {
    return (this as any).query().find(idOrIds);
  }

  /**
   * Static pass-through for findOrFail() with overloads
   */
  static async findOrFail<T extends AnyModelConstructor>(this: T, id: string | number): Promise<InstanceType<T>>;

  static async findOrFail<T extends AnyModelConstructor>(this: T, ids: (string | number)[]): Promise<InstanceType<T>[]>;

  static async findOrFail<T extends AnyModelConstructor>(
    this: T,
    idOrIds: string | number | (string | number)[],
  ): Promise<InstanceType<T> | InstanceType<T>[]> {
    return (this as any).query().findOrFail(idOrIds);
  }

  /**
   * Static pass-through for select()
   */
  static select<T extends AnyModelConstructor, K extends keyof InstanceType<T>["attributes"] & string>(
    this: T,
    ...columns: K[]
  ): Builder<InstanceType<T>, K> {
    return (this as any).query().select(...columns);
  }

  static with<T extends AnyModelConstructor>(this: T, ...relations: string[]): Builder<InstanceType<T>> {
    return (this as any).query().with(...relations);
  }

  /**
   * Defines a one-to-one or many-to-one relationship.
   * e.g., A Pet belongs to a Person.
   */
  belongsTo<R extends AnyModelConstructor>(
    relatedClass: R,
    foreignKey: keyof this["attributes"] & string,
    ownerKey: string = "id",
    relationName?: string, // Optional cache key override
  ): RelationBuilder<InstanceType<R>, InstanceType<R> | undefined> {
    const fkValue = this.attributes[foreignKey];
    const cacheKey = relationName || relatedClass.name;

    const builder = new RelationBuilder<InstanceType<R>, InstanceType<R> | undefined>(
      relatedClass,
      (b) => b.first(), // Resolves to a single model
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

    return builder.where(ownerKey, "=", fkValue);
  }

  /**
   * Defines a one-to-many relationship.
   * e.g., A Person has many Pets.
   */
  hasMany<R extends AnyModelConstructor>(
    relatedClass: R,
    foreignKey: string, // The column on the related table (e.g., 'person_id')
    localKey?: keyof this["attributes"] & string,
    relationName?: string,
  ): RelationBuilder<InstanceType<R>, InstanceType<R>[]> {
    const lKey = localKey || (this.primaryKey as string);
    const localValue = this.attributes[lKey as keyof typeof this.attributes];
    const cacheKey = relationName || relatedClass.name + "_many";

    const builder = new RelationBuilder<InstanceType<R>, InstanceType<R>[]>(
      relatedClass,
      (b) => b.get(), // Resolves to an array
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

    return builder.where(foreignKey, "=", localValue);
  }
}

// ... (Static methods go here)
