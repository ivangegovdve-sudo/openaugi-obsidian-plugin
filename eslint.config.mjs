// Obsidian community-directory compliance lint.
// Mirrors the automated scan that gates listing in the community directory:
// https://github.com/obsidianmd/eslint-plugin
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import { PlainTextParser } from "eslint-plugin-obsidianmd/dist/lib/plainTextParser.js";

export default defineConfig([
  globalIgnores([
    "node_modules/",
    "main.js",
    "tests/",
    "scripts/",
    "docs/",
    "esbuild.config.mjs",
    "vitest.config.ts",
    "version-bump.mjs",
  ]),

  ...obsidianmd.configs.recommended,

  // Source files. The type-checked rules in the recommended config need a
  // TypeScript project; allowDefaultProject covers files outside tsconfig.
  {
    files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*"],
        },
      },
    },
    rules: {
      // Proper nouns, product names, folder names and date placeholders that
      // the sentence-case rule would otherwise try to lowercase.
      "obsidianmd/ui/sentence-case": [
        "warn",
        {
          brands: [
            "OpenAugi",
            "OpenAI",
            "Obsidian",
            "Dataview",
            "Markdown",
            "iTerm2",
            "tmux",
          ],
          acronyms: ["AI", "API", "YYYY", "MM", "DD", "N"],
        },
      ],
    },
  },

  // The recommended config registers validate-manifest and validate-license but
  // matches no file for either, so neither ever runs. Wire them up explicitly —
  // the directory scan does check both. Both rules read a TypeScript-ESLint
  // AST, so manifest.json is parsed as JS (a bare object literal) rather than
  // with @eslint/json, and type-aware linting is off for these files.
  {
    files: ["manifest.json"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { projectService: false, project: null },
    },
    plugins: { obsidianmd },
    rules: {
      "obsidianmd/validate-manifest": "error",
    },
  },
  {
    files: ["LICENSE"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { parser: PlainTextParser },
    plugins: { obsidianmd },
    rules: {
      "obsidianmd/validate-license": "error",
    },
  },
]);
