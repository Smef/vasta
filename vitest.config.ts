import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  mode: "node",
  test: {
    dir: "./test/tests",
    include: ["./**/*.ts"],
    typecheck: {
      tsconfig: "./test/tsconfig.json",
      // Type-check the regular test files too, not just *.test-d.ts files
      include: ["./**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@src": resolve(__dirname, "src"),
      "@": resolve(__dirname, "test"),
      "vasta-orm": resolve(__dirname, "src/index.ts"),
    },
  },
});
