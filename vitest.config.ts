import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { join, resolve } from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  mode: "node",
  test: {
    include: ["./test/**/*.test.ts"],
    typecheck: {
      tsconfig: "./test/tsconfig.json",
    },
  },
  resolve: {
    alias: {
      "@src": resolve(process.cwd(), "src"),
      "@test": resolve(process.cwd(), "test"),
    },
  },
});
