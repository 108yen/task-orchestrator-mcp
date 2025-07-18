import type { TSESLint } from "@typescript-eslint/utils"
import vitestPlugin from "@vitest/eslint-plugin"
import { sharedTestFiles } from "./shared"

export const vitestConfig = {
  files: sharedTestFiles,
  name: "eslint/vitest",
  plugins: { vitest: vitestPlugin },
  rules: {
    ...vitestPlugin.configs.recommended.rules,
  },
} satisfies TSESLint.FlatConfig.Config
