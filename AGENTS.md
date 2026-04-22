# Instructions for `vasta`

## Project context

- This is a TypeScript codebase for an Laravel Eloquent-style model layer based on the Kysely query builder.
- Source code lives under `src/`.
- Tests and DB fixtures/migrations live under `test/`.
- The goal is to create a great developer experience with strong typing and IntelliSense.

## Implementation guidelines

- Keep changes minimal and focused on the requested task.
- Preserve existing public APIs unless explicitly asked to change them.
- Follow existing naming, file layout, and coding style in nearby files.
- Prefer straightforward implementations over over-engineered abstractions.

## TypeScript standards

- Keep strict typing; avoid `any` unless absolutely required.
- Reuse existing types in `src/types/` and `test/types/` before introducing new ones.
- Prefer explicit return types on exported functions and class methods.

## Testing expectations

- Add or update tests for behavior changes in `test/tests/`.
- Keep tests deterministic and isolated.
- When touching model behavior, verify both runtime behavior and type-level expectations where relevant.
