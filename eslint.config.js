// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

/**
 * Module boundaries: which src modules each module may import.
 * Anything not listed is forbidden, via its alias (@render/...) or a relative path (../render/...).
 */
const MODULES = ["shared", "engine", "themes", "render", "ui", "play", "pages", "app", "storage"];
const ALLOWED = {
  shared: [],
  engine: ["shared"],
  themes: ["shared", "engine"],
  render: ["shared", "engine", "themes"],
  ui: ["shared"],
  storage: ["shared"],
  play: ["shared", "engine", "themes", "render", "ui", "storage"],
  pages: ["shared", "engine", "themes", "render", "ui", "storage", "play"],
  app: MODULES,
};
/** Outside src: tools may only use the pure modules. */
const PURE = ["shared", "engine"];

/**
 * @param {string[]} allowed
 * @param {string} own
 */
function restrict(allowed, own) {
  const banned = MODULES.filter((m) => m !== own && !allowed.includes(m));
  if (banned.length === 0) return [];
  return [
    {
      group: banned.flatMap((m) => [`@${m}/**`, `**/${m}/**`]),
      message: "Import breaks the module boundaries (eslint.config.js).",
    },
  ];
}

/**
 * @param {{ group: string[]; message: string }[]} patterns
 * @returns {import("eslint").Linter.RuleEntry}
 */
function noImports(patterns) {
  return ["error", { patterns }];
}

/**
 * One no-restricted-imports config per module, plus tools/. Exported for tools/boundaries.test.ts.
 * @type {import("eslint").Linter.Config[]}
 */
export const boundaryConfigs = [
  ...Object.entries(ALLOWED).map(([own, allowed]) => ({
    files: [`src/${own}/**/*.ts`],
    rules: { "no-restricted-imports": noImports(restrict(allowed, own)) },
  })),
  {
    files: ["tools/**/*.ts"],
    rules: { "no-restricted-imports": noImports(restrict(PURE, "")) },
  },
];

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "coverage/",
      "playwright-report/",
      "test-results/",
      "solver/",
      "tests/fixtures/prototype-engine.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tools/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["tools/**/*.ts", "tests/**/*.ts", "*.config.ts", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  ...boundaryConfigs,
  prettier,
);
