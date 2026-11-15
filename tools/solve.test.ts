import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseLevel, validateLevel, verifySolution } from "@engine/index";
import type { LevelJson } from "@shared/types";
import { FIXTURE_CAMPAIGN, loadContent } from "./content-io";
import { formatLevel, solveLevel } from "./solve";
import { solveInputs } from "./solution";

const { registry, fixtures: levels } = loadContent();
const lvl01 = levels.find((l) => l.id === "lvl01") as LevelJson;
const hasUv = spawnSync("uv", ["--version"]).status === 0;

describe("solveInputs", () => {
  it("changes when anything the optimum depends on changes", () => {
    const base = solveInputs(registry, lvl01);
    expect(base).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(solveInputs(registry, { ...lvl01, text: "other words" })).toBe(base);
    expect(solveInputs(registry, { ...lvl01, pieces: { hedge: 4 } })).not.toBe(base);
    expect(
      solveInputs(registry, { ...lvl01, map: lvl01.map.map((r, y) => (y === 0 ? `m${r.slice(1)}` : r)) }),
    ).not.toBe(base);
  });
});

describe("formatLevel", () => {
  it("writes level files exactly as prettier formats the hand-written ones", async () => {
    for (const id of ["lvl01", "lvl03", "lvl08"]) {
      const file = join(FIXTURE_CAMPAIGN, `${id}.json`);
      const onDisk = readFileSync(file, "utf8");
      expect(await formatLevel(JSON.parse(onDisk) as LevelJson, file)).toBe(onDisk);
    }
  });
});

describe.skipIf(!hasUv)("solveLevel (needs uv)", () => {
  it("writes a proven, engine-checked solution that validate accepts", async () => {
    const { level, result, changed } = solveLevel(
      registry,
      { ...lvl01, solution: null },
      { time: 60, hintMs: 200 },
    );
    expect(changed).toBe(true);
    expect(result).toMatchObject({ score: 14, proven: true });
    expect(level.solution).toMatchObject({ score: 14, proven: true, method: "cp-sat" });
    expect(level.solution?.inputs).toBe(solveInputs(registry, lvl01));
    expect(verifySolution(parseLevel(registry, level), level.solution!)).toEqual({ ok: true, score: 14 });
    expect(validateLevel(registry, level)).toEqual([]);
    // Round trip through the file format.
    const text = await formatLevel(level, "lvl01.json");
    expect(JSON.parse(text)).toEqual(level);

    // A stored solution that is at least as good is kept.
    const again = solveLevel(registry, level, { time: 60, hintMs: 0 });
    expect(again.changed).toBe(false);
  }, 120_000);
});
