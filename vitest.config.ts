import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  mode: "node",
  test: {
    dir: "./test/tests",
    include: ["./**/*.ts"],
  },
  resolve: {
    alias: {
      "@src": resolve(__dirname, "src"),
      "@test": resolve(__dirname, "test"),
    },
  },
});
