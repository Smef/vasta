# Copilot Instructions for `vasta`

## Project context

- This is a TypeScript codebase for an Eloquent-style model layer.
- Source code lives under `src/`.
- Tests and DB fixtures/migrations live under `test/`.
- We'll often be converting Elqouent PHP code to TypeScript, but we want to adapt to TypeScript idioms and best practices rather than doing a line-by-line translation.
- If there's a missing functionality in the current codebase that you think is necessary to implement a requested change, please ask for the original PHP code for that function or a description of the expected behavior before implementing it. The eloquent Model class can be foudn here: /Users/smef/Code/Personal/database/Eloquent/Model.php if you want to refer to it for behavior or API expectations. Use this as a reference.

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

## Data and migrations

- Keep migrations additive and reversible where possible.
- Align model changes with corresponding migration updates in `test/database/migrations/` when needed.

## Change hygiene

- Do not modify unrelated files.
- Do not add new dependencies unless they are necessary for the task.
- Keep docs/readme updates concise when behavior or developer workflow changes.
