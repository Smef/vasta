import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["src/**/*.{js,ts,tsx,jsx}"],
    ...pluginJs.configs.recommended,
  },
  {
    files: ["src/**/*.{js,ts,tsx,jsx}"],
    ...tseslint.configs.recommended,
  },
  eslintConfigPrettier,
];
