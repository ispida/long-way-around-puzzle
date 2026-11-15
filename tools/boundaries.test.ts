/** Proves the module boundary rules catch wrong-direction imports. */
import { ESLint } from "eslint";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";
import { boundaryConfigs } from "../eslint.config.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: true,
  overrideConfig: [{ files: ["**/*.ts"], languageOptions: { parser: tseslint.parser } }, ...boundaryConfigs],
});

async function violations(file: string, importPath: string): Promise<number> {
  const [result] = await eslint.lintText(`import { x } from "${importPath}";\nexport { x };\n`, {
    filePath: join(root, file),
  });
  return (result?.messages ?? []).filter((m) => m.ruleId === "no-restricted-imports").length;
}

describe("module boundaries", () => {
  it.each([
    ["src/engine/route.ts", "@render/canvas"],
    ["src/engine/route.ts", "../render/canvas"],
    ["src/engine/route.ts", "@ui/text"],
    ["src/shared/types.ts", "@engine/route"],
    ["src/render/layers.ts", "@play/controller"],
    ["src/ui/layout.ts", "@app/config"],
    ["tools/solve.ts", "@play/screen"],
  ])("%s may not import %s", async (file, path) => {
    expect(await violations(file, path)).toBe(1);
  });

  it.each([
    ["src/engine/route.ts", "@shared/types"],
    ["src/engine/route.ts", "./board"],
    ["src/render/layers.ts", "@engine/route"],
    ["src/play/controller.ts", "@render/layers"],
    ["tools/solve.ts", "@shared/schemas"],
  ])("%s may import %s", async (file, path) => {
    expect(await violations(file, path)).toBe(0);
  });
});
