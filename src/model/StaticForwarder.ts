/* eslint-disable @typescript-eslint/no-explicit-any */

import { Expression, ExpressionBuilder } from "kysely";
import { Builder, ExtractDB, ExtractTB, Selection, ExtractSelection } from "@src/model/Builder";
import type { Model } from "@src/model/Model";

export type AnyModelConstructor = abstract new (...args: any[]) => Model<any, any>;
export type PrimaryKeyValue<T extends AnyModelConstructor> = InstanceType<T>["attributes"][InstanceType<T>["primaryKey"]];

export abstract class StaticForwarder {
  static query<T extends AnyModelConstructor>(this: T): Builder<InstanceType<T>> {
    return new Builder(this as any);
  }

  static where<T extends AnyModelConstructor>(
    this: T,
    expression:
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor, Column extends keyof InstanceType<T>["attributes"] & string>(
    this: T,
    column: Column,
    operator: string,
    value: InstanceType<T>["attributes"][Column] | null | Expression<any>,
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor, Column extends keyof InstanceType<T>["attributes"] & string>(
    this: T,
    column: Column,
    value: InstanceType<T>["attributes"][Column] | InstanceType<T>["attributes"][Column][] | null | Expression<any>,
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor>(
    this: T,
    column:
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
    operator: string,
    value: any,
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor>(
    this: T,
    column:
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
    value: any[] | any,
  ): Builder<InstanceType<T>>;

  static where<T extends AnyModelConstructor>(this: T, ...args: any[]): Builder<InstanceType<T>> {
    return (this as any).query().where(...args);
  }

  static whereIn<T extends AnyModelConstructor, Column extends keyof InstanceType<T>["attributes"] & string>(
    this: T,
    column: Column,
    values:
      | InstanceType<T>["attributes"][Column][]
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
  ): Builder<InstanceType<T>>;

  static whereIn<T extends AnyModelConstructor>(
    this: T,
    column:
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
    values:
      | any[]
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
  ): Builder<InstanceType<T>>;

  static whereIn<T extends AnyModelConstructor>(this: T, ...args: any[]): Builder<InstanceType<T>> {
    return (this as any).query().whereIn(...args);
  }

  static whereNotNull<T extends AnyModelConstructor>(
    this: T,
    column:
      | (keyof InstanceType<T>["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
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
    column:
      | (keyof InstanceType<T>["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => Expression<any>),
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

  static async find<T extends AnyModelConstructor>(this: T, id: PrimaryKeyValue<T>): Promise<InstanceType<T> | undefined>;

  static async find<T extends AnyModelConstructor>(this: T, ids: PrimaryKeyValue<T>[]): Promise<InstanceType<T>[]>;

  static async find<T extends AnyModelConstructor>(
    this: T,
    idOrIds: PrimaryKeyValue<T> | PrimaryKeyValue<T>[],
  ): Promise<InstanceType<T> | InstanceType<T>[] | undefined> {
    return (this as any).query().find(idOrIds);
  }

  static async findOrFail<T extends AnyModelConstructor>(this: T, id: PrimaryKeyValue<T>): Promise<InstanceType<T>>;

  static async findOrFail<T extends AnyModelConstructor>(this: T, ids: PrimaryKeyValue<T>[]): Promise<InstanceType<T>[]>;

  static async findOrFail<T extends AnyModelConstructor>(
    this: T,
    idOrIds: PrimaryKeyValue<T> | PrimaryKeyValue<T>[],
  ): Promise<InstanceType<T> | InstanceType<T>[]> {
    return (this as any).query().findOrFail(idOrIds);
  }

  static select<T extends AnyModelConstructor, const K extends Selection<InstanceType<T>>>(
    this: T,
    columns: K[] | ((eb: ExpressionBuilder<ExtractDB<InstanceType<T>>, ExtractTB<InstanceType<T>>>) => K[]),
  ): Builder<InstanceType<T>, ExtractSelection<K>> {
    return (this as any).query().select(columns);
  }

  static with<T extends AnyModelConstructor>(
    this: T,
    ...relations: (
      | import("./Builder").RelationKeys<InstanceType<T>>
      | import("./Builder").WithConstraints<InstanceType<T>>
    )[]
  ): Builder<InstanceType<T>> {
    return (this as any).query().with(...relations);
  }
}
