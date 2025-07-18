import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      include: ["src/**"],
      provider: "v8",
    },
    env: loadEnv("test", process.cwd(), ""),
    include: ["**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
  },
})
