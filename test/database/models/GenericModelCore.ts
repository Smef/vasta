import { Insertable, Kysely, Updateable, ReferenceExpression, InsertResult } from "kysely";

export default class GenericModel<Database extends Record<string, any>, TableName extends keyof Database & string> {
  protected db: Kysely<Database>;
  protected tableName: TableName;
  protected primaryKeyColumn: keyof Database[TableName] & string = "id";
  attributes: Database[TableName];
  protected existsInDatabase = false;

  constructor(options: {
    db: Kysely<Database>;
    tableName: TableName;
    primaryKeyColumn: string;
    attributes: Insertable<Database[TableName]>;
  }) {
    this.db = options.db;
    this.tableName = options.tableName;
    this.primaryKeyColumn = options.primaryKeyColumn;
    this.attributes = options.attributes as Database[TableName];
  }

  async save() {
    if (this.existsInDatabase) {
      return await this.update();
    }
    return await this.insert();
  }

  async insert() {
    const result = await this.db
      .insertInto(this.tableName)
      .values(this.attributes as Insertable<Database[TableName]>)
      .executeTakeFirst();

    // this now exists in the database
    this.existsInDatabase = true;
    if (result) {
      this.attributes = { ...this.attributes, ...result } as Database[TableName];
    }
    return result;
  }

  async update() {
    return await this.db
      .updateTable(this.tableName)
      .set(this.attributes as Updateable<Database[TableName]>)
      .where(this.primaryKeyColumn, "=", this.attributes[this.primaryKeyColumn])
      .executeTakeFirst();
  }

  static hydrate<Database extends Record<string, any>, TableName extends keyof Database & string>({
    db,
    tableName,
    attributes,
    primaryKeyColumn,
  }: {
    db: Kysely<Database>;
    tableName: TableName;
    attributes: Database[TableName];
    primaryKeyColumn: string;
  }) {
    const model = new this({ db, tableName, primaryKeyColumn, attributes });
    model.existsInDatabase = true;
    return model;
  }

  toJSON() {
    return this.attributes;
  }
}

type Attributes<Database> =
  | Insertable<Database[TableNameString<Database>]>
  | Updateable<Database[TableNameString<Database>]>
  | InsertResult;
type PrimaryKeyColumn<Database> = keyof Attributes<Database>;
type TableNameString<Database> = keyof Database & string;
