import type { TSESLint } from "@typescript-eslint/utils"
import type { Linter } from "eslint"
import prettierConfig from "eslint-config-prettier"
import typegen from "eslint-typegen"
import { resolve } from "node:path"
import tseslint from "typescript-eslint"
import {
  baseConfig,
  cspellConfig,
  importConfigArray,
  languageOptionFactory,
  perfectionistConfig,
  typescriptConfig,
  vitestConfig,
} from "./.eslint"

const ignoresConfig: Linter.Config = {
  ignores: [
    "dist/**",
    "@types/**",
    "node_modules/**",
    "build/**",
    "dist/**",
    "bin/**",
    "pnpm-lock.yaml",
    ".eslintcache",
  ],
  name: "eslint/ignores",
}

const tsConfigPath = resolve(__dirname, "./tsconfig.json")
const languageOptionConfig = languageOptionFactory(tsConfigPath)

const config: TSESLint.FlatConfig.ConfigArray = tseslint.config(
  ignoresConfig,
  languageOptionConfig,
  ...importConfigArray,
  baseConfig,
  typescriptConfig,
  prettierConfig,
  perfectionistConfig,
  cspellConfig,
  vitestConfig,
)

export default typegen(config as Linter.Config[], {
  dtsPath: "./@types/eslint-typegen.d.ts",
})
