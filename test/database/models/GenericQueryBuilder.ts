import { Kysely } from "kysely";

export default class GenericQueryBuilder<Database extends Record<string, any>> {
  protected db: Kysely<Database>;
  protected tableName: string;
  protected primaryKeyColumn = "id";

  constructor(db: Kysely<Database>, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  async find(primaryKey: number) {
    return await this.db
      .selectFrom(this.tableName)
      .selectAll()
      .where(this.primaryKeyColumn, "=", primaryKey)
      .executeTakeFirst();
  }

  async all() {
    return await this.db.selectFrom(this.tableName).selectAll().execute();
  }
}
