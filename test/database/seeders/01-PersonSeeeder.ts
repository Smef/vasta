import { Database } from "@/types/database";
import type { Kysely } from "kysely";

// replace `any` with your database interface.
export async function seed(db: Kysely<Database>): Promise<void> {
  // seed code goes here...
  // note: this function is mandatory. you must implement this function.
  await db
    .insertInto("people")
    .values([
      {
        name: "David",
        birthday: new Date("1986-07-20"),
        email: "david.nahodyl@gmail.com",
        favorite_color: "blue",
        phone: "404-123-1234",
        secret: "password123",
      },
      {
        name: "Kate",
        birthday: new Date("1986-11-20"),
        email: "kate.nahodyl@gmail.com",
        favorite_color: "green",
        phone: "404-555-0123",
        secret: "kate_secret",
      },
      {
        name: "Alex",
        birthday: new Date("1990-03-14"),
        email: "alex.morgan@example.com",
        favorite_color: "purple",
        phone: "770-555-0191",
        secret: "alex_secret",
      },
      {
        name: "Jordan",
        birthday: new Date("1992-09-02"),
        email: "jordan.lee@example.com",
        favorite_color: "orange",
        secret: "jordan_secret",
      },
      {
        name: "Priya",
        birthday: new Date("1989-12-05"),
        email: "priya.shah@example.com",
        favorite_color: "teal",
        phone: "770-555-0177",
        secret: "priya_secret",
      },
      {
        name: "Morgan",
        birthday: new Date("1994-06-18"),
        email: "morgan.rivera@example.com",
        favorite_color: "red",
        phone: "678-555-0168",
        secret: "morgan_secret",
      },
    ])
    .execute();
}
