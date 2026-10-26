import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** API integration tests: need `docker compose up -d` (Postgres + S3Mock). */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    name: "api",
    environment: "node",
    include: ["tests/api/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
