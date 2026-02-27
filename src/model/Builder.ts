/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely } from "kysely";
import { Model } from "@src/model/Model";
export type AnyModelConstructor = abstract new (...args: any[]) => Model<any, any>;

export type RelationMetadata = {
  type: "hasMany" | "belongsTo" | "hasOne";
  relatedClass: AnyModelConstructor;
  matchThisKey: string;
  matchRelatedKey: string;
  relationName: string;
};

export type SelectedModel<M extends Model<any, any>, S extends keyof M["attributes"] = never> = Omit<
  M,
  "attributes"
> & {
  attributes: [S] extends [never] ? M["attributes"] : Pick<M["attributes"], S>;
};

// Define the shape of our constraints
type Constraint =
  | { type: "where"; column: string; operator: string; value: any }
  | { type: "whereIn"; column: string; values: any[] }
  | { type: "whereNull"; column: string }
  | { type: "whereNotNull"; column: string };

export class Builder<M extends Model<any, any>, S extends keyof M["attributes"] = never> {
  protected constraints: Constraint[] = [];
  protected selectedColumns: string[] = []; // Track our columns
  protected eagerLoads: string[] = [];
  protected limitValue?: number;
  protected offsetValue?: number;
  protected orderings: { column: string; direction: "asc" | "desc" }[] = [];

  constructor(protected modelConstructor: AnyModelConstructor) {}
  where(column: keyof M["attributes"] & string, operator: string, value: any): this;
  where(column: keyof M["attributes"] & string, value: any[]): this;
  where(column: keyof M["attributes"] & string, value: any): this;
  where(column: string, opOrVal: any, value?: any): this {
    if (value !== undefined) {
      this.constraints.push({ type: "where", column, operator: opOrVal, value });
    } else if (Array.isArray(opOrVal)) {
      this.constraints.push({ type: "whereIn", column, values: opOrVal });
    } else {
      this.constraints.push({ type: "where", column, operator: "=", value: opOrVal });
    }
    return this;
  }

  orderBy(column: keyof M["attributes"] & string, direction: "asc" | "desc" = "asc"): this {
    this.orderings.push({ column, direction });
    return this;
  }

  whereIn(column: keyof M["attributes"] & string, values: any[]): this {
    this.constraints.push({ type: "whereIn", column, values });
    return this;
  }

  whereNotNull(column: keyof M["attributes"] & string): this {
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
  select<K extends keyof M["attributes"] & string>(...columns: K[]): Builder<M, S | K> {
    // Combines existing selections with new ones
    this.selectedColumns.push(...columns);
    // We must cast here because we are technically changing the builder's type signature
    return this as unknown as Builder<M, S | K>;
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
      query = query.select(this.selectedColumns as any) as any;
    } else {
      query = query.selectAll() as any;
    }

    // Apply all constraints
    for (const c of this.constraints) {
      if (c.type === "where") query = query.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") query = query.where(c.column, "in", c.values);
      else if (c.type === "whereNull") query = query.where(c.column, "is", null);
      else if (c.type === "whereNotNull") query = query.where(c.column, "is not", null);
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
      const instance = new (this.modelConstructor as any)(row);
      instance.exists = true;
      return instance as SelectedModel<M, S>;
    });

    await this.eagerLoad(instances);
    return instances;
  }

  async executeTakeFirst(): Promise<SelectedModel<M, S> | undefined> {
    const row = await this.compileQuery().executeTakeFirst();
    if (!row) return undefined;

    const instance = new (this.modelConstructor as any)(row);
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
      return this.get(); // Returns M[]
    } else {
      this.where(pkColumn as any, "=", idOrIds);
      return this.executeTakeFirst(); // Returns M | undefined
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
