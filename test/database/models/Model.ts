import GenericModelCore from "./GenericModelCore";
import { Kysely, Selectable, Insertable } from "kysely";
import StaticModelProxy from "./StaticModelProxy";
import GenericModel from "./GenericModelCore";

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
  async find(id: number) {
    const constructor = this.constructor as typeof Model & {
      db: Kysely<Database>;
      tableName: TableName;
    };

    return Model.findById(constructor.db, constructor.tableName, constructor.primaryKeyColumn, id);
  }

  // Static find method that can be called directly
  static find = async function <Database extends Record<string, any>, TN extends keyof Database & string>(
    this: { new (...args: any[]): Model<Database, TN>; db: Kysely<Database>; tableName: TN; primaryKeyColumn: string },
    id: number,
  ): Promise<Model<Database, TN> | null> {
    const result = await Model.findById(this.db, this.tableName, this.primaryKeyColumn, id);
    if (!result) return null;

    // Create new instance with the found data
    return GenericModel.hydrate({
      db: this.db,
      tableName: this.tableName,
      attributes: result as Database[TN],
      primaryKeyColumn: this.primaryKeyColumn,
    }) as Model<Database, TN>;
  };

  // Private static helper method that does the actual database query
  private static async findById<Database extends Record<string, any>, TableName extends keyof Database & string>(
    db: Kysely<Database>,
    tableName: TableName,
    primaryKeyColumn: string,
    id: number | string,
  ) {
    const result = await db.selectFrom(tableName).selectAll().where(primaryKeyColumn, "=", id).executeTakeFirst();

    if (!result) return null;

    return result as Selectable<Database[TableName]>;
  }
}
