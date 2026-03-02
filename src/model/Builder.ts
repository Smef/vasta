/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely, Expression, ExpressionBuilder, AliasedExpression } from "kysely";
import { Model } from "@src/model/Model";
export type AnyModelConstructor = abstract new (...args: any[]) => Model<any, any>;

export type RelationMetadata = {
  type: "hasMany" | "belongsTo" | "hasOne";
  relatedClass: AnyModelConstructor;
  matchThisKey: string;
  matchRelatedKey: string;
  relationName: string;
};

export type SelectedModel<M extends Model<any, any>, S extends keyof M["attributes"] | string = never> = Omit<
  M,
  "attributes" | (keyof M["attributes"] & string)
> & {
  attributes: [S] extends [never]
    ? M["attributes"]
    : Pick<M["attributes"], S & keyof M["attributes"]> & Record<Exclude<S, keyof M["attributes"]>, any>;
} & ([S] extends [never]
    ? M["attributes"]
    : Pick<M["attributes"], S & keyof M["attributes"]> & Record<Exclude<S, keyof M["attributes"]>, any>);

// Define the shape of our constraints
type Constraint =
  | { type: "where"; column: any; operator: string; value: any }
  | { type: "whereIn"; column: any; values: any[] | Expression<any> | ((eb: any) => Expression<any>) }
  | { type: "whereNull"; column: any }
  | { type: "whereNotNull"; column: any }
  | { type: "whereExpression"; expression: any };

export type ExtractDB<M> = M extends Model<infer D, any> ? D : never;
export type ExtractTB<M> = M extends Model<any, infer T> ? T : never;

export type Selection<M extends Model<any, any>> =
  | (keyof M["attributes"] & string)
  | Expression<unknown>
  | AliasedExpression<any, any>;

export type ExtractSelection<T> = T extends string ? T : T extends AliasedExpression<any, infer A> ? A : never;

export class Builder<M extends Model<any, any>, S extends keyof M["attributes"] | string = never> {
  protected constraints: Constraint[] = [];
  protected selectedColumns: (
    | string
    | Expression<unknown>
    | AliasedExpression<any, any>
    | ((eb: any) => (string | Expression<unknown> | AliasedExpression<any, any>)[])
  )[] = []; // Track our columns
  protected eagerLoads: string[] = [];
  protected limitValue?: number;
  protected offsetValue?: number;
  protected orderings: { column: any; direction: "asc" | "desc" }[] = [];

  constructor(protected modelConstructor: AnyModelConstructor) {}
  where(expression: Expression<any> | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>)): this;
  where(
    column:
      | (keyof M["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>),
    operator: string,
    value: any,
  ): this;
  where(
    column:
      | (keyof M["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>),
    value: any[],
  ): this;
  where(
    column:
      | (keyof M["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>),
    value: any,
  ): this;
  where(columnOrExpression: string | Expression<any> | Function, opOrVal?: any, value?: any): this {
    if (value !== undefined) {
      this.constraints.push({ type: "where", column: columnOrExpression, operator: opOrVal, value });
    } else if (Array.isArray(opOrVal)) {
      this.constraints.push({ type: "whereIn", column: columnOrExpression, values: opOrVal });
    } else if (opOrVal !== undefined) {
      this.constraints.push({ type: "where", column: columnOrExpression, operator: "=", value: opOrVal });
    } else if (
      typeof columnOrExpression === "function" ||
      (columnOrExpression !== null && typeof columnOrExpression === "object" && "toOperationNode" in columnOrExpression)
    ) {
      this.constraints.push({ type: "whereExpression", expression: columnOrExpression });
    } else {
      throw new Error("Invalid where arguments");
    }
    return this;
  }

  orderBy(
    column:
      | (keyof M["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>),
    direction: "asc" | "desc" = "asc",
  ): this {
    this.orderings.push({ column, direction });
    return this;
  }

  whereIn(
    column:
      | (keyof M["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>),
    values: any[] | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>) | Expression<any>,
  ): this {
    this.constraints.push({ type: "whereIn", column, values: values as any });
    return this;
  }

  whereNotNull(
    column:
      | (keyof M["attributes"] & string)
      | Expression<any>
      | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => Expression<any>),
  ): this {
    this.constraints.push({ type: "whereNotNull", column });
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  /**
   * Specify which columns to fetch from the database.
   */
  select<const K extends Selection<M>>(
    columns: K[] | ((eb: ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>) => K[]),
  ): Builder<M, S | ExtractSelection<K>> {
    if (typeof columns === "function") {
      this.selectedColumns.push(columns);
    } else {
      // Combines existing selections with new ones
      this.selectedColumns.push(...columns);
    }
    // We must cast here because we are technically changing the builder's type signature
    return this as unknown as Builder<M, S | ExtractSelection<K>>;
  }

  with(...relations: string[]): this {
    this.eagerLoads.push(...relations);
    return this;
  }

  protected async eagerLoad(models: any[]): Promise<void> {
    if (models.length === 0 || this.eagerLoads.length === 0) {
      return;
    }

    for (const relation of this.eagerLoads) {
      const relationBuilder = models[0][relation] as RelationBuilder<any, any>;

      if (!relationBuilder || !relationBuilder.relationMetadata) {
        throw new Error(`Relation '${relation}' is not properly defined or does not return a RelationBuilder.`);
      }

      const meta = relationBuilder.relationMetadata;

      const keys = [
        ...new Set(
          models
            .map((model) => model.attributes[meta.matchThisKey])
            .filter((value) => value !== null && value !== undefined),
        ),
      ];

      if (keys.length === 0) {
        continue;
      }

      const relatedRecords = await (meta.relatedClass as any).query().whereIn(meta.matchRelatedKey, keys).get();

      for (const model of models) {
        if (!model.loadedRelations) {
          model.loadedRelations = {};
        }

        const myValue = model.attributes[meta.matchThisKey];

        if (meta.type === "hasMany") {
          model.loadedRelations[meta.relationName] = relatedRecords.filter(
            (record: any) => record.attributes[meta.matchRelatedKey] === myValue,
          );
        } else {
          model.loadedRelations[meta.relationName] =
            relatedRecords.find((record: any) => record.attributes[meta.matchRelatedKey] === myValue) ?? null;
        }
      }
    }
  }

  // ... existing where() and find() methods ...

  private compileQuery() {
    const dummy = new (this.modelConstructor as any)({});
    const db = dummy.db as Kysely<any>;
    const table = dummy.table as string;

    // Start the query
    let query = db.selectFrom(table);

    // Apply specific columns or fall back to selectAll()
    if (this.selectedColumns.length > 0) {
      // We need to re-map the selected columns to handle callbacks separately
      const simpleColumns = this.selectedColumns.filter((c) => typeof c !== "function");
      const callbacks = this.selectedColumns.filter((c) => typeof c === "function");

      if (simpleColumns.length > 0) {
        query = query.select(simpleColumns as any) as any;
      }

      for (const callback of callbacks) {
        query = query.select(callback as any) as any;
      }
    } else {
      query = query.selectAll() as any;
    }

    // Apply all constraints
    for (const c of this.constraints) {
      if (c.type === "where") query = query.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") query = query.where(c.column, "in", c.values);
      else if (c.type === "whereNull") query = query.where(c.column, "is", null);
      else if (c.type === "whereNotNull") query = query.where(c.column, "is not", null);
      else if (c.type === "whereExpression") query = query.where(c.expression as any);
    }

    for (const order of this.orderings) {
      query = query.orderBy(order.column as any, order.direction) as any;
    }

    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue) as any;
    }

    if (this.offsetValue !== undefined) {
      query = query.offset(this.offsetValue) as any;
    }

    return query;
  }

  async get(): Promise<SelectedModel<M, S>[]> {
    const rows = await this.compileQuery().execute();
    const instances = rows.map((row: any) => {
      // Pass isNew=false (the second arg) so we don't apply defaults
      // The constructor takes (attributes, isNew)
      const instance = new (this.modelConstructor as any)(row, false);
      instance.exists = true;
      return instance as SelectedModel<M, S>;
    });

    await this.eagerLoad(instances);
    return instances;
  }

  async executeTakeFirst(): Promise<SelectedModel<M, S> | undefined> {
    const row = (await this.compileQuery().executeTakeFirst()) as any;
    // console.log("ROW:", row);
    // console.log("Selected Columns:", this.selectedColumns);

    if (!row) return undefined;

    // Pass isNew=false (the second arg) so we don't apply defaults
    const instance = new (this.modelConstructor as any)(row, false);
    instance.exists = true;

    await this.eagerLoad([instance]);
    return instance as SelectedModel<M, S>;
  }

  async first(): Promise<SelectedModel<M, S> | undefined> {
    return this.executeTakeFirst();
  }

  async firstOrFail(): Promise<SelectedModel<M, S>> {
    const result = await this.first();
    if (!result) {
      throw new Error(`Record not found.`);
    }
    return result;
  }

  async count(): Promise<number> {
    const dummy = new (this.modelConstructor as any)({});
    const db = dummy.db as Kysely<any>;
    const table = dummy.table as string;

    let query = db.selectFrom(table).select((eb) => eb.fn.countAll().as("count"));

    for (const c of this.constraints) {
      if (c.type === "where") query = query.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") query = query.where(c.column, "in", c.values);
      else if (c.type === "whereNull") query = query.where(c.column, "is", null);
      else if (c.type === "whereNotNull") query = query.where(c.column, "is not", null);
      else if (c.type === "whereExpression") query = query.where(c.expression as any);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.count || 0);
  }

  async sum(column: keyof M["attributes"] & string): Promise<number> {
    const dummy = new (this.modelConstructor as any)({});
    const db = dummy.db as Kysely<any>;
    const table = dummy.table as string;

    let query = db.selectFrom(table).select((eb) => eb.fn.sum(column).as("sum"));

    for (const c of this.constraints) {
      if (c.type === "where") query = query.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") query = query.where(c.column, "in", c.values);
      else if (c.type === "whereNull") query = query.where(c.column, "is", null);
      else if (c.type === "whereNotNull") query = query.where(c.column, "is not", null);
      else if (c.type === "whereExpression") query = query.where(c.expression as any);
    }

    const result = await query.executeTakeFirst();
    return Number(result?.sum || 0);
  }

  async max(column: keyof M["attributes"] & string): Promise<number | null> {
    const dummy = new (this.modelConstructor as any)({});
    const db = dummy.db as Kysely<any>;
    const table = dummy.table as string;

    let query = db.selectFrom(table).select((eb) => eb.fn.max(column).as("max"));

    for (const c of this.constraints) {
      if (c.type === "where") query = query.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") query = query.where(c.column, "in", c.values);
      else if (c.type === "whereNull") query = query.where(c.column, "is", null);
      else if (c.type === "whereNotNull") query = query.where(c.column, "is not", null);
      else if (c.type === "whereExpression") query = query.where(c.expression as any);
    }

    const result = await query.executeTakeFirst();
    return result?.max !== null && result?.max !== undefined ? Number(result.max) : null;
  }

  async paginate(
    perPage: number = 15,
    page: number = 1,
  ): Promise<{
    data: SelectedModel<M, S>[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  }> {
    const dummy = new (this.modelConstructor as any)({});
    const db = dummy.db as Kysely<any>;
    const table = dummy.table as string;

    let countQuery = db.selectFrom(table).select((eb) => eb.fn.countAll().as("count"));

    for (const c of this.constraints) {
      if (c.type === "where") countQuery = countQuery.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") countQuery = countQuery.where(c.column, "in", c.values);
      else if (c.type === "whereNull") countQuery = countQuery.where(c.column, "is", null);
      else if (c.type === "whereNotNull") countQuery = countQuery.where(c.column, "is not", null);
      else if (c.type === "whereExpression") countQuery = countQuery.where(c.expression as any);
    }

    const countResult = await countQuery.executeTakeFirst();
    const total = Number(countResult?.count || 0);

    this.limit(perPage);
    this.offset((page - 1) * perPage);

    const data = await this.get();

    return {
      data,
      total,
      perPage,
      currentPage: page,
      lastPage: Math.ceil(total / perPage),
    };
  }

  /**
   * Overload Signatures
   */
  async find(id: string | number): Promise<M | undefined>;
  async find(ids: (string | number)[]): Promise<M[]>;
  /**
   * Finds a record by its primary key.
   * Immediately executes the query.
   */
  async find(idOrIds: string | number | (string | number)[]): Promise<M | M[] | undefined> {
    const dummy = new (this.modelConstructor as any)({});
    const pkColumn = dummy.primaryKey as string;

    if (Array.isArray(idOrIds)) {
      if (idOrIds.length === 0) return []; // Optimization for empty arrays

      this.whereIn(pkColumn as any, idOrIds);
      return this.get() as any; // Returns M[]
    } else {
      this.where(pkColumn as any, "=", idOrIds);
      return this.executeTakeFirst() as any; // Returns M | undefined
    }
  }

  /**
   * Overload Signatures for findOrFail
   */
  async findOrFail(id: string | number): Promise<M>;
  async findOrFail(ids: (string | number)[]): Promise<M[]>;

  /**
   * Implementation
   */
  async findOrFail(idOrIds: string | number | (string | number)[]): Promise<M | M[]> {
    if (Array.isArray(idOrIds)) {
      // 1. Remove duplicates so we have an accurate expected count
      const uniqueIds = Array.from(new Set(idOrIds));

      // 2. Fetch the records
      const results = await this.find(uniqueIds);

      // 3. Compare the counts
      if (results.length !== uniqueIds.length) {
        throw new Error(`Expected to find ${uniqueIds.length} records, but only found ${results.length}.`);
      }

      return results;
    } else {
      // Single ID logic
      const result = await this.find(idOrIds);

      if (!result) {
        throw new Error(`Record with primary key ${idOrIds} not found.`);
      }

      return result;
    }
  }
}

export default Builder;

/**
 * A specialized Builder that acts as a Promise.
 * If awaited directly, it executes the query and caches the result.
 */
export class RelationBuilder<M extends Model<any, any>, R> extends Builder<M> implements PromiseLike<R> {
  constructor(
    modelConstructor: AnyModelConstructor,
    private resolver: (builder: Builder<M>) => Promise<R>,
    private cacheKey: string,
    private instance: any, // The parent model instance
    public relationMetadata: RelationMetadata,
  ) {
    super(modelConstructor);
  }

  then<TResult1 = R, TResult2 = never>(
    onfulfilled?: ((value: R) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    // Ensure the cache object exists on the instance
    if (!this.instance.loadedRelations) {
      this.instance.loadedRelations = {};
    }
    const cache = this.instance.loadedRelations;

    // Safety Check: If the user chained .where() or .limit(), we DO NOT cache it,
    // because it is a filtered subset, not the full relationship.
    const isModified = this.constraints.length > 1 || this.selectedColumns.length > 0 || this.limitValue !== undefined;

    // 1. Return from cache if untouched and available
    if (!isModified && this.cacheKey in cache) {
      return Promise.resolve(cache[this.cacheKey]).then(onfulfilled, onrejected);
    }

    // 2. Execute, Cache, and Return
    return this.resolver(this)
      .then((result) => {
        if (!isModified) {
          cache[this.cacheKey] = result; // Only cache pure relationships
        }
        return result;
      })
      .then(onfulfilled, onrejected);
  }
}
