import type { Linter } from "eslint"
import perfectionistPlugin from "eslint-plugin-perfectionist"
import { sharedFiles } from "./shared"

export const perfectionistConfig: Linter.Config = {
  files: sharedFiles,
  name: "eslint/perfectionist",
  plugins: {
    perfectionist: perfectionistPlugin,
  },
  rules: {
    ...perfectionistPlugin.configs["recommended-natural"].rules,
    "perfectionist/sort-classes": "off",
    "perfectionist/sort-imports": [
      "error",
      { newlinesBetween: "never", type: "natural" },
    ],
    "perfectionist/sort-modules": [
      "error",
      {
        groups: [
          "declare-enum",
          "export-enum",
          "enum",
          ["declare-interface", "declare-type"],
          ["export-interface", "export-type"],
          "declare-class",
          "class",
          "export-class",
          "declare-function",
        ],
      },
    ],
    "perfectionist/sort-objects": ["error", { partitionByNewLine: true }],
  },
}
