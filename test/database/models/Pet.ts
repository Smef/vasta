import Model from "./Model";
import { Database } from "../../types/database";
import db from "../db";
import { Insertable } from "kysely";

export default class Pet extends Model<Database, "pets"> {
  static db = db;
  static tableName = "pets" as const;
  // static primaryKeyColumn = "id" as const;

  constructor(attributes: Insertable<Database["pets"]>) {
    super();
  }
}
