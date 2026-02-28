# Vasta

Vasta is a type-safe eloquent model layer for [Kysely](https://kysely.dev/) with syntax and usage inspired by [Laravel's Eloquent ORM](https://laravel.com/docs/12.x/eloquent). With Vasta, you can define your models and relationships in a clean and intuitive way, while still leveraging the power and flexibility of Kysely for your database interactions.

Vasta provides an active-record style interface for querying and manipulating your data. This making it easy to work with your database in a more intuitive and readable manner.

## Usage

To get started with Vasta, you can define your models by extending the `Model` class and specifying the table name and attributes. You can then use the provided query builder methods to perform various database operations.

### Installation

You can install Vasta using your preferred package manager.

```bash
pnpm install vasta
```

### Define your Kysely instance and types

Begin by following the Kysely instructions for setting up your database Types and connection. In particular, the Types and Instantiation sections are relevant to Vasta.

[Kysely Setup Instructions](https://kysely.dev/docs/getting-started#types)

You can see an example of database types used by this repository for testing in [test/types/database.ts](test/types/database.ts).

An example database connection can be found in [test/database/db.ts](test/database/db.ts).

This is all just standar Kysely setup up to this point, so follow thier instructions for this part!

### Define your Vasta Models

You'll need to create new classes for each of your models, extending the defineModel function provided by Vasta. Each model should specify the corresponding table name and define its attributes.

The defineModel function takes an object with the following properties:

- `db`: This should be set to your Kysely database instance.
- `table`: This should be set to the name of the table in your database that this model represents. This should be a string typed `as const`.
- `primaryKey`: (optional) the primary key column for the table, defaults to "id".

```ts
import { defineModel } from "vasta";
import db from "@/database/db";
import Pet from "@/database/models/Pet";

export default class Person extends defineModel({
  db, // Your Kysely database instance
  table: "people", // the name of the table in your Kysely database type that this model represents
  id: "id", // optional, defaults to "id"
}) {
  // A Person has many Pets
  get pets() {
    // We pass the Pet class, and the foreign key column on the pets table
    return this.hasMany(Pet, "person_id", "id", "pets");
  }
}
```

#### Relationships

Vasta supports defining relationships between your models. You can define relationships such as `hasMany`, `belongsTo` to easily navigate between related models. Related models can be eager loaded or lazy loaded as needed.

for example, if you have a `Person` model and a `Pet` model, you can define the relationships as follows:

```ts
// In Person model
get pets() {
  return this.hasMany(Pet, "person_id", "id", "pets");
}
```

```ts
// In Pet model
get owner() {
  return this.belongsTo(Person, "person_id", "id", "owner");
}
```

Then you can lazy-load a person's pets or a pet's owner:

```ts
const person = await Person.find(1);
const pets = await person.pets; // Get all pets belonging to the person
```

You can also eager load relationships to optimize your queries:

```ts
const person = await Person.with("pets").find(1);
const pets = person.pets; // This will not trigger a new query, as the pets were eager loaded
```

Lazy loaded relationship queries can also be further constrained:

```ts
const person = await Person.findOrFail(3);
const bird = await person.pets.where("type", "bird").first();
```

### Model Functions

You can define your own functions on your models to handle common operations.

As an example, let's say we want to have a function to increment a counter on our model. We can define this function on our model like so:

```ts
export default class Pet extends defineModel({...}) {
  // increment a counter and save the model in a single call
  incrementCounter() {
    console.log("Incrementing counter for pet:", this.attributes.name);
    this.attributes.counter += 1;
    return this.save();
  }
}
```

And then that function can be called on the model instance directly.

```ts
const pet = await Pet.findOrFail(1);
await pet.incrementCounter();
```

### Default Attributes

You can also specify default attributes for your models. These attributes will be applied to the model instance if they are not provided when creating a new instance. Creating a new instance with missing attributes that have defaults will not throw a type error, and the defaults will be applied instead.

```ts
export default class Pet extends defineModel({
  // ...other config
  attributes: {
    counter: 0,
  },
}) {
```

### Mass Assignment

Vasta supports mass assignment of attributes through the `assign` method. This allows you to update multiple attributes of a model instance in a single call. This functions similarly to `Object.assign(mode.attributes, newattributes)`

````ts
const pet = await Pet.findOrFail(1);
pet.assign({
  name: "New Name",
  counter: pet.attributes.counter + 1,
});
await pet.save();

## Local Development

### Set up your database

The tests in this package are currently configured to work on a Postgres database. To run the tests, you'll need to have a Postgres database set up and running to connect to.

Copy the `.env.example` file to `.env` and fill in your database connection details.

### Install package dependencies with pnpm

```sh
pnpm install
````

### Run database migrations and seeds

```sh
pnpm db:migrate
pnpm db:seed
```

### run tests with vitest

```sh
pnpm test
```

You can also reset the databse and re-run the tests with a single command:

```sh
pnpm test:reset
```
