import { Selectable, type Kysely } from "kysely";
import db from "~~/server/database/db";

type QueryBuilderOptions = {
  primaryKeyColumn: string;
  protectedColumns?: string[];
};

export function modelQueryBuilder<T extends Kysely<any>, S extends string>(
  db: T,
  schema: S,
  options: QueryBuilderOptions,
) {
  const nameSymbol: unique symbol = Symbol.for("drizzle:Name");

  async function all() {
    // get all results
    const results = await db.selectFrom("pets").selectAll().execute();
    // create models from results
    const models = results.map((result) => createModelFromResult(result));
    // return models
    return models;
  }

  async function find(primaryKey: number) {
    const idColumn = options.primaryKeyColumn;

    // // const table = queryBuilder[nameSymbol] as keyof typeof db.query;
    // const results = await db.select().from(schema).limit(1).where(eq(idColumn, primaryKey));

    // // return null if results size is 0
    // if (results.length === 0) {
    //   return null;
    // }

    // const result = results[0];

    // if (!result) {
    //   return null;
    // }

    // return createModelFromResult(result);
  }

  async function findMany<Q extends SQL<unknown> | undefined>(query: Q) {
    return await db.select().from(schema).where(query);
  }

  const builder = {
    all,
    find,
    findMany,
  };

  return builder;

  function createModelFromResult<
    R extends {
      [K in keyof {
        [Key in keyof GetSelectTableSelection<S> & string]: SelectResultField<GetSelectTableSelection<S>[Key], true>;
      }]: {
        [Key in keyof GetSelectTableSelection<S> & string]: SelectResultField<GetSelectTableSelection<S>[Key], true>;
      }[K];
    },
  >(result: R) {
    const realModel = {
      attributes: result,
      originalAttributes: structuredClone(result),
      primaryKeyColumn: options.primaryKeyColumn,
      protectedColumns: options.protectedColumns ?? [],
      modifiedAttributes: function () {
        const modified: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(this.attributes)) {
          const originalValue = this.originalAttributes[key as keyof typeof this.originalAttributes];
          if (value !== originalValue) {
            modified[key] = value;
          }
        }
        return modified;
      },
      save: async function () {
        const modifiedAttributes = this.modifiedAttributes();

        // If no attributes have been modified, do not save
        if (Object.keys(modifiedAttributes).length === 0) {
          return;
        }

        const result = await db
          .update(schema)
          .set(modifiedAttributes)
          .where(
            eq(options.primaryKeyColumn, this.attributes[this.primaryKeyColumn.name as keyof typeof this.attributes]),
          );
        return result;
      },
      toJSON: function () {
        // remove protected attributes
        const attributes = structuredClone(this.attributes);
        for (const column of this.protectedColumns) {
          if (typeof column === "string") {
            delete attributes[column as keyof typeof attributes];
          }
          if (column instanceof MySqlColumn) {
            delete attributes[column.name as keyof typeof attributes];
          }
        }
        return attributes;
      },
      isDirty: function () {
        return Object.keys(this.modifiedAttributes()).length > 0;
      },
    };

    const handler = {
      get(target: typeof realModel, prop: any) {
        if (prop in target.attributes) {
          return Reflect.get(target.attributes, prop);
        }

        return Reflect.get(target, prop);
      },
      set(target: typeof realModel, prop: any, value: never) {
        if (prop in target.attributes) {
          return Reflect.set(target.attributes, prop, value);
        }
        return Reflect.set(target, prop, value);
      },
    };

    type ProxyModel<PM extends { attributes: any }> = {
      [key in keyof PM["attributes"]]: PM["attributes"][key];
    };

    type ExtendedProxyModel<RM extends { attributes: any }> = ProxyModel<RM> & RM;

    const proxyModel = new Proxy(realModel, handler) as ExtendedProxyModel<typeof realModel>;
    return proxyModel;
  }
}
