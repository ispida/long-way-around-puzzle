import { describe, expect, it } from "vitest";
import { encodeSolution, parseLevel, validateLevel } from "@engine/index";
import { makeLevel, registry } from "./helpers";

const check = (map: string[], extra: Record<string, unknown> = {}) =>
  validateLevel(registry(), { ...makeLevel(map, { hedge: 3 }), ...extra });

describe("validateLevel", () => {
  it("accepts a good level", () => {
    expect(check(["B...H"])).toEqual([]);
  });
  it("reports structural problems with cells", () => {
    expect(check(["B.X.H"])).toEqual([{ message: 'unknown map character "X"', cell: { x: 2, y: 0 } }]);
    expect(check(["....H"])).toEqual([{ message: "the level has no start" }]);
    expect(check(["B.B.H"])).toEqual([{ message: "more than one start", cell: { x: 2, y: 0 } }]);
    expect(check(["B...."])).toEqual([{ message: "the level has no goal" }]);
    expect(check(["B.1.H"])).toEqual([
      { message: 'portal "1" needs exactly 2 cells, found 1', cell: { x: 2, y: 0 } },
    ]);
  });
  it("reports budgets and rule sets", () => {
    expect(validateLevel(registry(), makeLevel(["B..H"], { puddle: 1 }))).toEqual([
      { message: 'unknown piece "puddle"' },
    ]);
    expect(validateLevel(registry(), makeLevel(["B..H"], { hedge: 0 }))).toEqual([
      { message: "the level gives the player no pieces" },
    ]);
    expect(check(["B..H"], { rules: "chaos" })).toEqual([{ message: 'unknown rule set "chaos"' }]);
  });
  it("reports a start that is already cut off and a wrong startScore", () => {
    expect(check(["BT.H"])).toEqual([
      { message: "the start is cut off from every goal on the empty board", cell: { x: 0, y: 0 } },
    ]);
    expect(check(["B..H"], { startScore: 5 })).toEqual([
      { message: "startScore is 5, but the level starts at 3" },
    ]);
  });
  it("verifies a stored solution", () => {
    const level = { ...makeLevel(["B...H", "....."], { hedge: 3 }), startScore: 4 };
    const b = parseLevel(registry(), level);
    const data = encodeSolution(b, new Map([[2, "hedge"]]));
    const sol = {
      score: 6,
      proven: true,
      data,
      method: "cp-sat" as const,
      solvedAt: "2026-10-03",
      engineVersion: 1,
    };
    expect(validateLevel(registry(), { ...level, solution: sol })).toEqual([]);
    expect(validateLevel(registry(), { ...level, solution: { ...sol, score: 9 } })).toEqual([
      { message: "solution: solution scores 6, but claims 9" },
    ]);
  });
});
