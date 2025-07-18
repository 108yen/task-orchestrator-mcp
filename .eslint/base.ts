import type { Linter } from "eslint"
import eslint from "@eslint/js"
import { sharedFiles } from "./shared"

export const baseConfig: Linter.Config = {
  files: sharedFiles,
  name: "eslint/base",
  rules: {
    ...eslint.configs.recommended.rules,
    "no-console": "error",
    "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
  },
}
