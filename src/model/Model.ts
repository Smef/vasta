import GenericModelCore from "./GenericModelCore";
import { Kysely, Selectable, Insertable, OperandValueExpressionOrList } from "kysely";
import { ExtractTableAlias } from "kysely/dist/esm/parser/table-parser";

export default abstract class Model<
  Database extends Record<string, any>,
  TableName extends keyof Database & string,
> extends GenericModelCore<Database, TableName> {
  // Make these abstract statics that must be implemented by child classes
  static db: Kysely<any>;
  static tableName: string;
  static primaryKeyColumn: string = "id";

  constructor(
    options: {
      db: Kysely<Database>;
      tableName: TableName;
      primaryKeyColumn: string;
      attributes: Insertable<Database[TableName]>;
    } = {
      db: Model.db,
      tableName: Model.tableName as TableName,
      primaryKeyColumn: "id",
      attributes: {} as Insertable<Database[TableName]>,
    },
  ) {
    super({
      db: options.db,
      tableName: options.tableName,
      primaryKeyColumn: options.primaryKeyColumn,
      attributes: options.attributes,
    });
  }

  // Instance find method
  async find(id: OperandValueExpressionOrList<Database, ExtractTableAlias<Database, TableName>, string>) {
    const constructor = this.constructor as typeof Model & {
      db: Kysely<Database>;
      tableName: TableName;
    };

    return Model.findById(constructor.db, constructor.tableName, constructor.primaryKeyColumn, id);
  }

  // Static find method that can be called directly
  static find = async function <
    Database extends Record<string, any>,
    TableName extends keyof Database & string,
    PrimaryKeyValue extends OperandValueExpressionOrList<Database, ExtractTableAlias<Database, TableName>, string>,
  >(
    this: {
      new (...args: any[]): Model<Database, TableName>;
      db: Kysely<Database>;
      tableName: TableName;
      primaryKeyColumn: string;
    },
    id: PrimaryKeyValue,
  ): Promise<Model<Database, TableName> | null> {
    const result = await Model.findById(this.db, this.tableName, this.primaryKeyColumn, id);
    if (!result) return null;

    // Create new instance with the found data
    return GenericModelCore.hydrate({
      db: this.db,
      tableName: this.tableName,
      attributes: result as Database[TableName],
      primaryKeyColumn: this.primaryKeyColumn,
    }) as Model<Database, TableName>;
  };

  // Private static helper method that does the actual database query
  private static async findById<
    Database extends Record<string, any>,
    TableName extends keyof Database & string,
    PrimaryKeyValue extends OperandValueExpressionOrList<Database, ExtractTableAlias<Database, TableName>, string>,
  >(db: Kysely<Database>, tableName: TableName, primaryKeyColumn: string, id: PrimaryKeyValue) {
    const result = await db
      .selectFrom(tableName)
      .selectAll()
      .where(primaryKeyColumn, "=", id as any)
      .executeTakeFirst();

    if (!result) return null;

    return result as Selectable<Database[TableName]>;
  }
}
