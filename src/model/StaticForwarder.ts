/* eslint-disable @typescript-eslint/no-explicit-any */

import { ComparisonOperatorExpression } from "kysely";
import {
  Builder,
  ColumnArg,
  ExpressionArg,
  ModelExpressionBuilder,
  RelationKeys,
  Selection,
  ExtractSelection,
  AnyModelConstructor,
  WhereShorthandValue,
  WhereValue,
  WithConstraints,
  PrimaryKeyValue as ModelPrimaryKeyValue,
} from "./Builder.js";

export { AnyModelConstructor };
export type PrimaryKeyValue<T extends AnyModelConstructor> = ModelPrimaryKeyValue<InstanceType<T>>;

/**
 * Shorthands for the forwarded signatures below.
 *
 * Every static must re-declare its Builder counterpart with a `this: T` parameter so
 * TypeScript late-binds T to the concrete class at the call site: `Pet.where(...)`
 * infers from `typeof Pet`, including relations and methods added on the subclass
 * after defineModel. TypeScript has no way to derive such signatures from Builder
 * mechanically (that would require higher-kinded types), so each method is declared
 * by hand and these aliases keep the declarations short.
 */
type Inst<T extends AnyModelConstructor> = InstanceType<T>;
type Q<T extends AnyModelConstructor, S extends string = never> = Builder<Inst<T>, S>;

export abstract class StaticForwarder {
  static query<T extends AnyModelConstructor>(this: T): Q<T> {
    return new Builder(this as any);
  }

  static where<T extends AnyModelConstructor>(this: T, expression: ExpressionArg<Inst<T>>): Q<T>;
  static where<T extends AnyModelConstructor, Column extends ColumnArg<Inst<T>>>(
    this: T,
    column: Column,
    operator: ComparisonOperatorExpression,
    value: WhereValue<Inst<T>, Column>,
  ): Q<T>;
  static where<T extends AnyModelConstructor, Column extends ColumnArg<Inst<T>>>(
    this: T,
    column: Column,
    value: WhereShorthandValue<Inst<T>, Column>,
  ): Q<T>;
  static where<T extends AnyModelConstructor>(this: T, ...args: any[]): Q<T> {
    return (this as any).query().where(...args);
  }

  static whereIn<T extends AnyModelConstructor, Column extends keyof Inst<T>["attributes"] & string>(
    this: T,
    column: Column,
    values: Inst<T>["attributes"][Column][] | ExpressionArg<Inst<T>>,
  ): Q<T>;
  static whereIn<T extends AnyModelConstructor>(
    this: T,
    column: ExpressionArg<Inst<T>>,
    values: any[] | ExpressionArg<Inst<T>>,
  ): Q<T>;
  static whereIn<T extends AnyModelConstructor>(this: T, ...args: any[]): Q<T> {
    return (this as any).query().whereIn(...args);
  }

  static whereNull<T extends AnyModelConstructor>(this: T, column: ColumnArg<Inst<T>>): Q<T> {
    return (this as any).query().whereNull(column);
  }

  static whereNotNull<T extends AnyModelConstructor>(this: T, column: ColumnArg<Inst<T>>): Q<T> {
    return (this as any).query().whereNotNull(column);
  }

  static limit<T extends AnyModelConstructor>(this: T, value: number): Q<T> {
    return (this as any).query().limit(value);
  }

  static offset<T extends AnyModelConstructor>(this: T, value: number): Q<T> {
    return (this as any).query().offset(value);
  }

  static orderBy<T extends AnyModelConstructor>(
    this: T,
    column: ColumnArg<Inst<T>>,
    direction: "asc" | "desc" = "asc",
  ): Q<T> {
    return (this as any).query().orderBy(column, direction);
  }

  static async get<T extends AnyModelConstructor>(this: T): Promise<Inst<T>[]> {
    return (this as any).query().get();
  }

  static async all<T extends AnyModelConstructor>(this: T): Promise<Inst<T>[]> {
    return (this as any).query().get();
  }

  static async first<T extends AnyModelConstructor>(this: T): Promise<Inst<T> | undefined> {
    return (this as any).query().first();
  }

  static async firstOrFail<T extends AnyModelConstructor>(this: T): Promise<Inst<T>> {
    return (this as any).query().firstOrFail();
  }

  static async count<T extends AnyModelConstructor>(this: T): Promise<number> {
    return (this as any).query().count();
  }

  static async sum<T extends AnyModelConstructor>(
    this: T,
    column: keyof Inst<T>["attributes"] & string,
  ): Promise<number> {
    return (this as any).query().sum(column);
  }

  static async max<T extends AnyModelConstructor>(
    this: T,
    column: keyof Inst<T>["attributes"] & string,
  ): Promise<number | null> {
    return (this as any).query().max(column);
  }

  static async paginate<T extends AnyModelConstructor>(
    this: T,
    perPage?: number,
    page?: number,
  ): Promise<{
    data: Inst<T>[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  }> {
    return (this as any).query().paginate(perPage, page);
  }

  static async find<T extends AnyModelConstructor>(this: T, id: PrimaryKeyValue<T>): Promise<Inst<T> | undefined>;
  static async find<T extends AnyModelConstructor>(this: T, ids: PrimaryKeyValue<T>[]): Promise<Inst<T>[]>;
  static async find<T extends AnyModelConstructor>(
    this: T,
    idOrIds: PrimaryKeyValue<T> | PrimaryKeyValue<T>[],
  ): Promise<Inst<T> | Inst<T>[] | undefined> {
    return (this as any).query().find(idOrIds);
  }

  static async findOrFail<T extends AnyModelConstructor>(this: T, id: PrimaryKeyValue<T>): Promise<Inst<T>>;
  static async findOrFail<T extends AnyModelConstructor>(this: T, ids: PrimaryKeyValue<T>[]): Promise<Inst<T>[]>;
  static async findOrFail<T extends AnyModelConstructor>(
    this: T,
    idOrIds: PrimaryKeyValue<T> | PrimaryKeyValue<T>[],
  ): Promise<Inst<T> | Inst<T>[]> {
    return (this as any).query().findOrFail(idOrIds);
  }

  static async destroy<T extends AnyModelConstructor>(
    this: T,
    idOrIds: PrimaryKeyValue<T> | PrimaryKeyValue<T>[],
  ): Promise<number> {
    return (this as any).query().destroy(idOrIds);
  }

  static async create<T extends AnyModelConstructor>(
    this: T,
    attributes: ConstructorParameters<T>[0],
  ): Promise<Inst<T>>;
  static async create<T extends AnyModelConstructor>(
    this: T,
    attributes: ConstructorParameters<T>[0][],
  ): Promise<Inst<T>[]>;
  static async create<T extends AnyModelConstructor>(
    this: T,
    attributes: ConstructorParameters<T>[0] | ConstructorParameters<T>[0][],
  ): Promise<Inst<T> | Inst<T>[]> {
    if (Array.isArray(attributes)) {
      return (this as any).createMany(attributes);
    }
    const instance = new (this as any)(attributes);
    await instance.save();
    return instance;
  }

  static async createMany<T extends AnyModelConstructor>(
    this: T,
    attributes: ConstructorParameters<T>[0][],
  ): Promise<Inst<T>[]> {
    const instances = attributes.map((attrs) => new (this as any)(attrs)) as Inst<T>[];
    if (instances.length === 0) {
      return instances;
    }

    // Dispatch "saving" and "creating" events for each instance before inserting into the database
    for (const instance of instances) {
      await instance.dispatchEvent("saving");
      await instance.dispatchEvent("creating");
    }

    const { db, table } = instances[0];
    const rows = await (db as any)
      .insertInto(table)
      .values(instances.map((instance) => instance.getRawAttributes()))
      .returningAll()
      .execute();

    // The instances have been saved to the database, so we should dispatch the "created" and "saved" events for each instance and set their attributes accordingly
    for (const [index, instance] of instances.entries()) {
      const row = rows[index];
      if (row) {
        instance.setRawAttributes(row);
        instance.originalAttributes = { ...instance.attributes };
        instance.exists = true;
        await instance.dispatchEvent("created");
      }
      await instance.dispatchEvent("saved");
    }

    return instances;
  }

  static select<T extends AnyModelConstructor, const K extends Selection<Inst<T>>>(
    this: T,
    columns: K[] | ((eb: ModelExpressionBuilder<Inst<T>>) => K[]),
  ): Q<T, ExtractSelection<K>> {
    return (this as any).query().select(columns);
  }

  static with<T extends AnyModelConstructor>(
    this: T,
    ...relations: (RelationKeys<Inst<T>> | WithConstraints<Inst<T>>)[]
  ): Q<T> {
    return (this as any).query().with(...relations);
  }
}
