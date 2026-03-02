---
seo:
  title: Vasta - Type-safe, active record style ORM model layer for Node.js
  description: Define your models and relationships in a type-safe way with Vasta.
---

::u-page-hero
---

---
#title
  :::u-color-mode-image
  ---
  light: "/img/logo/wordmark-dark.svg"
  dark: "/img/logo/wordmark-light.svg"
  alt: "Vasta Logo"
  class: "w-auto max-w-96 mx-auto"
  ---
  :::

#description
<p>A <span class=" italic underline text-black dark:text-white italics">type-safe</span> active record model layer for <a href="https://kysely.dev/" target="_blank">Kysely</a> with syntax and usage inspired by <a href="https://laravel.com/docs/12.x/eloquent" target="_blank">Laravel's Eloquent ORM</a>.</p>

#links
  :::u-button
  ---
  color: neutral
  size: xl
  to: /getting-started/introduction
  trailing-icon: i-lucide-arrow-right
  ---
  Get started
  :::

  :::u-button
  ---
  color: neutral
  icon: simple-icons-github
  size: xl
  to: https://github.com/smef/vasta
  variant: outline
  ---
  GitHub
  :::

#default

  :::u-page-card
  ---
  class: max-w-2xl mx-auto
  title: "Simple active record pattern"
  ---
  ```js
  const pet = await Pet.findOrFail(1);
  pet.name = "Fluffy";
  await pet.save();
  ```
  :::


::


