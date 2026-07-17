/* eslint-disable @typescript-eslint/no-explicit-any */
import { Kysely, Expression, ExpressionBuilder, AliasedExpression, ComparisonOperatorExpression } from "kysely";
import { Model } from "./Model.js";

export type Bivariant<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? { bivarianceHack(...args: A): R }["bivarianceHack"]
    : T[K];
};

export type AnyModelConstructor = abstract new (...args: any[]) => Bivariant<Model<any, any, any>>;

export interface ModelLike {
  db: Kysely<any>;
  table: string;
  attributes: Record<string, any>;
  primaryKey: string;
}

export type RelationMetadata = {
  type: "hasMany" | "belongsTo" | "hasOne" | "belongsToMany";
  relatedClass: AnyModelConstructor;
  matchThisKey: string;
  matchRelatedKey: string;
  relationName: string;
  pivotTable?: string;
  foreignPivotKey?: string;
  relatedPivotKey?: string;
};

/** The attributes visible after a select(): known columns keep their types, computed selections are `any`. */
type SelectedAttributes<M extends ModelLike, S extends PropertyKey> = Pick<M["attributes"], S & keyof M["attributes"]> &
  Record<Exclude<S, keyof M["attributes"]>, any>;

export type SelectedModel<M extends ModelLike, S extends keyof M["attributes"] | string = never> =
  // If no columns were explicitly selected, return the full model untouched.
  [S] extends [never]
    ? M
    : // Strip out the attributes object, save/delete, AND the dynamic top-level properties
      Omit<M, "attributes" | "save" | "delete" | (keyof M["attributes"] & string)> &
        // Conditionally restore save/delete if the primary key is selected
        ([Extract<M["primaryKey"], S & string>] extends [never]
          ? {
              save: never;
              delete: never;
            }
          : Pick<M, keyof M & ("save" | "delete")>) &
        // Restore the attributes object and the dynamic top-level accessors, containing ONLY the selected keys
        { attributes: SelectedAttributes<M, S> } & SelectedAttributes<M, S>;

// Define the shape of our constraints
type Constraint =
  | { type: "where"; column: any; operator: string; value: any }
  | { type: "whereIn"; column: any; values: any[] | Expression<any> | ((eb: any) => Expression<any>) }
  | { type: "whereNull"; column: any }
  | { type: "whereNotNull"; column: any }
  | { type: "whereExpression"; expression: any };

type JoinConstraint = {
  type: "innerJoin" | "leftJoin";
  table: string;
  col1: string;
  col2: string;
};

export type ExtractDB<M> = M extends { db: Kysely<infer D> } ? D : never;
export type ExtractTB<M> = M extends { table: infer T } ? T : never;

/** The Kysely expression builder scoped to this model's database and table. */
export type ModelExpressionBuilder<M extends ModelLike> = ExpressionBuilder<ExtractDB<M>, ExtractTB<M>>;

/** A raw Kysely expression, or a callback that builds one. Accepted anywhere a dynamic expression is allowed. */
export type ExpressionArg<M extends ModelLike> = Expression<any> | ((eb: ModelExpressionBuilder<M>) => Expression<any>);

/** A typed column name, or any expression accepted where a column can appear. */
export type ColumnArg<M extends ModelLike> = (keyof M["attributes"] & string) | ExpressionArg<M>;

/** The value for `where(column, operator, value)`: typed when the column is a known attribute. */
export type WhereValue<M extends ModelLike, C> = C extends keyof M["attributes"] & string
  ? M["attributes"][C] | null | Expression<any>
  : any;

/** The value for the two-argument `where(column, value)` shorthand; an array means `in`. */
export type WhereShorthandValue<M extends ModelLike, C> = C extends keyof M["attributes"] & string
  ? M["attributes"][C] | M["attributes"][C][] | null | Expression<any>
  : any[] | any;

export type Selection<M extends ModelLike> =
  | (keyof M["attributes"] & string)
  | Expression<unknown>
  | AliasedExpression<any, any>;

export type ExtractSelection<T> = T extends string ? T : T extends AliasedExpression<any, infer A> ? A : never;
export type PrimaryKeyValue<M extends ModelLike> = M["attributes"][M["primaryKey"]];

export type RelationKeys<M> = {
  [K in keyof M]-?: M[K] extends RelationBuilder<any, any> ? K : never;
}[keyof M & string];

export type WithConstraints<M> = {
  [K in RelationKeys<M>]?: M[K] extends RelationBuilder<infer RM, any> ? (query: Builder<RM>) => void : never;
};

/** Constraint callbacks for withCount(), keyed by relation name. */
export type CountConstraints<M> = {
  [K in RelationKeys<M>]?: M[K] extends RelationBuilder<infer RM, any> ? (query: Builder<RM>) => void : never;
};

/** The relation names counted by a withCount() call: string arguments plus constraint object keys. */
export type CountedRelations<A> = A extends string ? A : keyof A & string;

/** A model type augmented with the `${relation}Count` attributes added by withCount(). */
export type WithCounted<M extends ModelLike, R extends string> = M &
  Record<`${R}Count`, number> & { attributes: Record<`${R}Count`, number> };

export class Builder<M extends ModelLike, S extends keyof M["attributes"] | string = never> {
  protected constraints: Constraint[] = [];
  protected joinConstraints: JoinConstraint[] = [];
  protected selectedColumns: (
    | string
    | Expression<unknown>
    | AliasedExpression<any, any>
    | ((eb: any) => (string | Expression<unknown> | AliasedExpression<any, any>)[])
  )[] = []; // Track our columns
  protected selectAllTables: string[] = [];
  protected eagerLoads: { relation: string; constraint?: (query: Builder<any>) => void }[] = [];
  protected relationCounts: { relation: string; constraint?: (query: Builder<any>) => void }[] = [];
  protected limitValue?: number;
  protected offsetValue?: number;
  protected orderings: { column: any; direction: "asc" | "desc" }[] = [];
  /** Connection override (e.g. a transaction) used instead of the model's configured db. */
  protected connection?: Kysely<any>;

  constructor(
    protected modelConstructor: AnyModelConstructor,
    connection?: Kysely<any>,
  ) {
    this.connection = connection;
  }

  /**
   * Sets the connection (e.g. a transaction) the query runs on instead of the model's
   * configured db. Models returned by the query keep the connection, so save, delete,
   * and relations on them stay on the same connection.
   */
  useConnection(connection: Kysely<ExtractDB<M>> | undefined): this {
    this.connection = connection;
    return this;
  }
  where(expression: ExpressionArg<M>): this;
  where<Column extends ColumnArg<M>>(
    column: Column,
    operator: ComparisonOperatorExpression,
    value: WhereValue<M, Column>,
  ): this;
  where<Column extends ColumnArg<M>>(column: Column, value: WhereShorthandValue<M, Column>): this;
  where(columnOrExpression: string | ExpressionArg<M>, opOrVal?: any, value?: any): this {
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

  orderBy(column: ColumnArg<M>, direction: "asc" | "desc" = "asc"): this {
    this.orderings.push({ column, direction });
    return this;
  }

  whereIn<Column extends keyof M["attributes"] & string>(
    column: Column,
    values: M["attributes"][Column][] | ExpressionArg<M>,
  ): this;
  whereIn(column: ExpressionArg<M>, values: any[] | ExpressionArg<M>): this;
  whereIn(column: string | ExpressionArg<M>, values: any): this {
    this.constraints.push({ type: "whereIn", column, values: values as any });
    return this;
  }

  whereNull(column: ColumnArg<M>): this {
    this.constraints.push({ type: "whereNull", column });
    return this;
  }

  whereNotNull(column: ColumnArg<M>): this {
    this.constraints.push({ type: "whereNotNull", column });
    return this;
  }

  innerJoin(table: string, col1: string, col2: string): this {
    this.joinConstraints.push({ type: "innerJoin", table, col1, col2 });
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
    columns: K[] | ((eb: ModelExpressionBuilder<M>) => K[]),
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

  selectAll(table: string): this {
    this.selectAllTables.push(table);
    return this;
  }

  with(...relations: (RelationKeys<M> | WithConstraints<M>)[]): this {
    for (const relation of relations) {
      if (typeof relation === "string") {
        this.eagerLoads.push({ relation });
      } else {
        for (const [key, constraint] of Object.entries(relation as Record<string, any>)) {
          this.eagerLoads.push({ relation: key, constraint });
        }
      }
    }
    return this;
  }

  /**
   * Adds a `${relation}Count` attribute to each result, holding the number of related records.
   * Accepts relation names and/or objects mapping relation names to constraint callbacks.
   */
  withCount<Args extends (RelationKeys<M> | CountConstraints<M>)[]>(
    ...relations: Args
  ): Builder<WithCounted<M, CountedRelations<Args[number]>>, S> {
    for (const relation of relations) {
      if (typeof relation === "string") {
        this.relationCounts.push({ relation });
      } else {
        for (const [key, constraint] of Object.entries(relation as Record<string, any>)) {
          this.relationCounts.push({ relation: key, constraint });
        }
      }
    }
    // We must cast here because we are technically changing the builder's type signature
    return this as unknown as Builder<WithCounted<M, CountedRelations<Args[number]>>, S>;
  }

  /** Reads a relation's metadata by instantiating a throwaway model and accessing the relation getter. */
  protected relationMeta(relation: string): RelationMetadata {
    const dummy = new (this.modelConstructor as any)({});
    const relationBuilder = dummy[relation] as RelationBuilder<any, any> | undefined;
    if (!relationBuilder?.relationMetadata) {
      throw new Error(`Relation '${relation}' is not properly defined or does not return a RelationBuilder.`);
    }
    return relationBuilder.relationMetadata;
  }

  /** Builds a correlated subquery counting related records, aliased as `${relation}Count`. */
  private relationCountSelect(eb: any, relation: string, constraint?: (query: Builder<any>) => void): any {
    const meta = this.relationMeta(relation);
    const { table } = this.modelMeta();
    const relatedTable = new (meta.relatedClass as any)({}).table;
    const alias = `${relation}Count`;

    let subquery: any;
    if (meta.type === "belongsToMany") {
      subquery = eb
        .selectFrom(meta.pivotTable!)
        .innerJoin(
          relatedTable,
          `${meta.pivotTable!}.${meta.relatedPivotKey!}`,
          `${relatedTable}.${meta.matchRelatedKey}`,
        )
        .whereRef(`${meta.pivotTable!}.${meta.foreignPivotKey!}`, "=", `${table}.${meta.matchThisKey}`);
    } else {
      subquery = eb
        .selectFrom(relatedTable)
        .whereRef(`${relatedTable}.${meta.matchRelatedKey}`, "=", `${table}.${meta.matchThisKey}`);
    }

    if (constraint) {
      const constraintBuilder = new Builder<any>(meta.relatedClass);
      constraint(constraintBuilder);
      subquery = constraintBuilder.applyConstraints(subquery);
    }

    // Cast to integer so drivers that return bigint counts as strings still produce numbers
    return subquery.select((seb: any) => seb.cast(seb.fn.countAll(), "integer").as(alias)).as(alias);
  }

  protected async eagerLoad(models: any[]): Promise<void> {
    if (models.length === 0 || this.eagerLoads.length === 0) {
      return;
    }

    for (const { relation, constraint } of this.eagerLoads) {
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

      let query: Builder<any>;

      if (meta.type === "belongsToMany") {
        const dummy = new (meta.relatedClass as any)({});
        const table = dummy.table;
        query = (meta.relatedClass as any)
          .query(this.connection)
          .innerJoin(
            meta.pivotTable!,
            `${meta.pivotTable!}.${meta.relatedPivotKey!}`,
            `${table}.${meta.matchRelatedKey}`,
          )
          .whereIn(`${meta.pivotTable!}.${meta.foreignPivotKey!}`, keys)
          .selectAll(table)
          .select([`${meta.pivotTable!}.${meta.foreignPivotKey!} as _pivot_foreign_key`]);
      } else {
        query = (meta.relatedClass as any).query(this.connection).whereIn(meta.matchRelatedKey, keys);
      }

      if (constraint) {
        constraint(query);
      }

      const relatedRecords = await query.get();

      for (const model of models) {
        if (!model.loadedRelations) {
          model.loadedRelations = {};
        }

        const myValue = model.attributes[meta.matchThisKey];

        if (meta.type === "hasMany") {
          model.loadedRelations[meta.relationName] = relatedRecords.filter(
            (record: any) => record.attributes[meta.matchRelatedKey] === myValue,
          );
        } else if (meta.type === "belongsToMany") {
          model.loadedRelations[meta.relationName] = relatedRecords.filter(
            (record: any) => record.attributes["_pivot_foreign_key"] === myValue,
          );
        } else {
          model.loadedRelations[meta.relationName] =
            relatedRecords.find((record: any) => record.attributes[meta.matchRelatedKey] === myValue) ?? null;
        }
      }
    }
  }

  /** Instantiates a throwaway model to read its configuration (db, table, primaryKey). */
  protected modelMeta(): { db: Kysely<any>; table: string; primaryKey: string } {
    const dummy = new (this.modelConstructor as any)({});
    return { db: this.connection ?? dummy.db, table: dummy.table, primaryKey: dummy.primaryKey };
  }

  /** Applies all accumulated where-constraints to a Kysely select query. */
  protected applyConstraints(query: any): any {
    for (const c of this.constraints) {
      if (c.type === "where") query = query.where(c.column, c.operator as any, c.value);
      else if (c.type === "whereIn") query = query.where(c.column, "in", c.values);
      else if (c.type === "whereNull") query = query.where(c.column, "is", null);
      else if (c.type === "whereNotNull") query = query.where(c.column, "is not", null);
      else if (c.type === "whereExpression") query = query.where(c.expression as any);
    }
    return query;
  }

  private compileQuery() {
    const { db, table } = this.modelMeta();

    // Start the query
    let query = db.selectFrom(table);

    // Apply joins
    for (const j of this.joinConstraints) {
      if (j.type === "innerJoin") {
        query = query.innerJoin(j.table as any, j.col1 as any, j.col2 as any) as any;
      }
    }

    // Apply specific columns or fall back to selectAll()
    for (const table of this.selectAllTables) {
      query = query.selectAll(table as any) as any;
    }

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
    } else if (this.selectAllTables.length === 0) {
      query = query.selectAll() as any;
    }

    for (const { relation, constraint } of this.relationCounts) {
      query = query.select((eb: any) => this.relationCountSelect(eb, relation, constraint)) as any;
    }

    query = this.applyConstraints(query);

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

  async execute(): Promise<SelectedModel<M, S>[]> {
    const rows = await this.compileQuery().execute();
    const instances = rows.map((row: any) => {
      // Pass isNew=false (the second arg) so we don't apply defaults
      // The constructor takes (attributes, isNew)
      const instance = new (this.modelConstructor as any)(row, false);
      instance.exists = true;
      if (this.connection) instance.connection = this.connection;
      return instance as SelectedModel<M, S>;
    });

    await this.eagerLoad(instances);
    return instances;
  }

  async get(): Promise<SelectedModel<M, S>[]> {
    return this.execute();
  }

  async executeTakeFirst(): Promise<SelectedModel<M, S> | undefined> {
    const row = (await this.compileQuery().executeTakeFirst()) as any;

    if (!row) return undefined;

    // Pass isNew=false (the second arg) so we don't apply defaults
    const instance = new (this.modelConstructor as any)(row, false);
    instance.exists = true;
    if (this.connection) instance.connection = this.connection;

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

  /** Runs a single-value aggregate (count, sum, max, ...) with the accumulated constraints applied. */
  private async aggregate(select: (eb: ExpressionBuilder<any, any>) => any): Promise<unknown> {
    const { db, table } = this.modelMeta();
    const query = this.applyConstraints(db.selectFrom(table).select((eb: any) => select(eb).as("value")));
    const result = await query.executeTakeFirst();
    return result?.value;
  }

  async count(): Promise<number> {
    return Number((await this.aggregate((eb) => eb.fn.countAll())) || 0);
  }

  async sum(column: keyof M["attributes"] & string): Promise<number> {
    return Number((await this.aggregate((eb) => eb.fn.sum(column))) || 0);
  }

  async max(column: keyof M["attributes"] & string): Promise<number | null> {
    const value = await this.aggregate((eb) => eb.fn.max(column));
    return value !== null && value !== undefined ? Number(value) : null;
  }

  async min(column: keyof M["attributes"] & string): Promise<number | null> {
    const value = await this.aggregate((eb) => eb.fn.min(column));
    return value !== null && value !== undefined ? Number(value) : null;
  }

  async avg(column: keyof M["attributes"] & string): Promise<number | null> {
    const value = await this.aggregate((eb) => eb.fn.avg(column));
    return value !== null && value !== undefined ? Number(value) : null;
  }

  /** Returns true if any record matches the accumulated constraints. */
  async exists(): Promise<boolean> {
    const { db, table } = this.modelMeta();
    const query = this.applyConstraints(db.selectFrom(table).select((eb: any) => eb.lit(1).as("value"))).limit(1);
    const result = await query.executeTakeFirst();
    return result !== undefined;
  }

  /** Returns true if no records match the accumulated constraints. */
  async doesntExist(): Promise<boolean> {
    return !(await this.exists());
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
    const total = await this.count();

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
  async find(id: PrimaryKeyValue<M>): Promise<M | undefined>;
  async find(ids: PrimaryKeyValue<M>[]): Promise<M[]>;
  /**
   * Finds a record by its primary key.
   * Immediately executes the query.
   */
  async find(idOrIds: PrimaryKeyValue<M> | PrimaryKeyValue<M>[]): Promise<M | M[] | undefined> {
    const pkColumn = this.modelMeta().primaryKey;

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
  async findOrFail(id: PrimaryKeyValue<M>): Promise<M>;
  async findOrFail(ids: PrimaryKeyValue<M>[]): Promise<M[]>;

  /**
   * Implementation
   */
  async findOrFail(idOrIds: PrimaryKeyValue<M> | PrimaryKeyValue<M>[]): Promise<M | M[]> {
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

  /**
   * Destroys one or more records by their primary key(s).
   * Retrieves the models and calls delete() on each to ensure lifecycle events are fired.
   * Returns the number of successfully deleted records.
   */
  async destroy(idOrIds: PrimaryKeyValue<M> | PrimaryKeyValue<M>[]): Promise<number> {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    if (ids.length === 0) return 0;

    const models = await this.find(ids);

    let count = 0;
    for (const model of models as M[]) {
      const deleted = await (model as any).delete();
      if (deleted) count++;
    }

    return count;
  }
}

export default Builder;

/**
 * A specialized Builder that acts as a Promise.
 * If awaited directly, it executes the query and caches the result.
 */
export class RelationBuilder<M extends ModelLike, R> extends Builder<M> implements PromiseLike<R> {
  protected initialConstraintsCount = 0;
  protected initialSelectedColumnsCount = 0;

  constructor(
    modelConstructor: AnyModelConstructor,
    private resolver: (builder: Builder<M>) => Promise<R>,
    private cacheKey: string,
    private instance: any, // The parent model instance
    public relationMetadata: RelationMetadata,
  ) {
    // Relations run on the parent model's connection, so a model loaded in a
    // transaction reads its relations through the same transaction.
    super(modelConstructor, instance?.connection);
  }

  public _markClean() {
    this.initialConstraintsCount = this.constraints.length;
    this.initialSelectedColumnsCount = this.selectedColumns.length;
    return this;
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
    const isModified =
      this.constraints.length > Math.max(1, this.initialConstraintsCount) ||
      this.selectedColumns.length > this.initialSelectedColumnsCount ||
      this.limitValue !== undefined;

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
