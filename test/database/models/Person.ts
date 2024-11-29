import Model from "./Model";
import { Database } from "../../types/database";
import db from "../db";
import { Insertable } from "kysely";

export default class Person extends Model<Database, "people"> {
  static db = db;
  static tableName = "people" as const;
  // static primaryKeyColumn = "id" as const;

  constructor(attributes: Insertable<Database["people"]>) {
    super();
  }
}
