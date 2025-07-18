import type { Linter } from "eslint"
import cspellPlugin from "@cspell/eslint-plugin"
import { resolve } from "node:path"
import cspellJson from "../cspell.json"
import { sharedFiles } from "./shared"

export const cspellConfig: Linter.Config = {
  files: sharedFiles,
  ignores: cspellJson.ignorePaths,
  name: "eslint/cspell",
  plugins: { "@cspell": cspellPlugin },
  rules: {
    "@cspell/spellchecker": [
      "warn",
      {
        autoFix: false,
        configFile: resolve(__dirname, "../cspell.json"),
        cspell: {},
        generateSuggestions: true,
        numSuggestions: 5,
      },
    ],
  },
}
