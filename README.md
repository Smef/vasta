# Vasta

<p>
  <a href="https://npmx.dev/package/vasta-orm"><img src="https://img.shields.io/npm/v/vasta-orm.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="Version"></a>
  <a href="https://github.com/nuxt/nuxt/blob/main/LICENSE"><img src="https://img.shields.io/github/license/nuxt/nuxt.svg?style=flat&colorA=18181B&colorB=28CF8D" alt="License"></a>

</p>

Vasta is a type-safe Object Relational Mapper (ORM) layer for [Kysely](https://kysely.dev/) with syntax and usage inspired by [Laravel's Eloquent ORM](https://laravel.com/docs/12.x/eloquent). With Vasta, you can define your models and relationships in a clean and intuitive way, while still leveraging the power and flexibility of Kysely for your database interactions.

Vasta provides an [active record pattern](https://en.wikipedia.org/wiki/Active_record_pattern) interface for querying and manipulating your data, making it easy to work with your database in a model-instance oriented way. You can define your models with attributes, relationships, methods, and more. You can use these model properties to perform actions directly on your models before easily saving those changes to the database.


```js
const pet = await Pet.findOrFail(1);
pet.name = "Fluffy";
await pet.save();
```

## Documentation

Check out the [official documentation page](https://vastajs.com/) for usage instructions and examples.
