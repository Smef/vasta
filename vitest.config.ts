import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  mode: "node",
  test: {
    dir: "./test/tests",
    include: ["./**/*.ts"],
    typecheck: {
      tsconfig: "./test/tsconfig.json",
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
