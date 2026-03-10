import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  mode: "node",
  test: {
    dir: "./test/tests",
    include: ["./**/*.ts"],
  },
  resolve: {
    alias: {
      "@src": resolve(__dirname, "src"),
      "@": resolve(__dirname, "test"),
    },
  },
});
