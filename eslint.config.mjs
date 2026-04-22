import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: ["dist/**/*", "docs/.nuxt/**", "docs/.data/**", "docs/.output/**"],
  },
  {
    files: ["src/**/*.ts", "docs/**/*.{ts}", "test/**/*.{ts}"],
    extends: [js.configs.recommended, tseslint.configs.recommended, eslintConfigPrettier],
  },
]);
