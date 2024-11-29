import { Kysely, Selectable } from "kysely";

export default class StaticModelProxy {
  static async findById<D, TN extends keyof D & string>(
    db: Kysely<D>,
    tableName: TN,
    id: number,
  ): Promise<Selectable<D[TN]> | undefined> {
    return db.selectFrom(tableName).selectAll().where("id", "=", id).executeTakeFirst();
  }

  static newQuery<Database extends Record<string, any>, TN extends keyof Database & string>(
    db: Kysely<Database>,
    tableName: TN,
  ) {
    return db.selectFrom(tableName);
  }
}
