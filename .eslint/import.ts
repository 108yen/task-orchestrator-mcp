import type { Linter } from "eslint"
import { fixupPluginRules } from "@eslint/compat"
import { flatConfigs } from "eslint-plugin-import"
import unusedImportsPlugin from "eslint-plugin-unused-imports"
import { sharedFiles } from "./shared"

export const importConfigArray: Linter.Config[] = [
  {
    files: sharedFiles,
    name: "eslint/import/order",
    plugins: {
      import: fixupPluginRules(flatConfigs.recommended.plugins.import),
    },
    rules: {
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import/no-anonymous-default-export": "error",
    },
    settings: {
      "import/parser": {
        "typescript-eslint-parser": [
          ".js",
          ".cjs",
          ".mjs",
          ".jsx",
          ".ts",
          ".cts",
          ".mts",
          ".tsx",
          ".d.ts",
        ],
      },
      "import/resolver": {
        node: true,
        typescript: true,
      },
    },
  },
  {
    files: sharedFiles,
    name: "eslint/import/unused",
    plugins: {
      "unused-imports": unusedImportsPlugin,
    },
    rules: {
      "unused-imports/no-unused-imports": "error",
    },
  },
]
