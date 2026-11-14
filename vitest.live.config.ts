import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// Live reader test: calls the real Gemini API with the key from .env.local.
// One screenshot at a time, to stay inside the free usage limits.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["scripts/**/*.live.test.ts"],
    env: { GEMINI_API_KEY: loadEnv("", process.cwd(), "GEMINI_").GEMINI_API_KEY ?? "" },
    testTimeout: 120_000,
    hookTimeout: 240_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
