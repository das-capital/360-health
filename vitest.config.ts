import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Normal unit tests: fast, no network.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"] },
});
