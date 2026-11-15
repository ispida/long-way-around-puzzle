import { describe, expect, it } from "vitest";
import { decodeSolution, encodeSolution, parseLevel, route, score, verifySolution } from "@engine/index";
import type { Solution } from "@shared/types";
import { content } from "./helpers";

const lvl = () => {
  const level = content().levels.find((l) => l.id === "lvl01")!;
  return parseLevel(content().registry, level);
};
const solution = (data: string, s: number): Solution => ({
  score: s,
  proven: true,
  data,
  method: "cp-sat",
  solvedAt: "2026-10-03",
  engineVersion: 1,
});

describe("solutions", () => {
  it("round-trips placements and hides them from plain view", () => {
    const b = lvl();
    const placements = new Map([
      [12, "hedge"],
      [30, "hedge"],
      [3, "hedge"],
    ]);
    const data = encodeSolution(b, placements);
    expect(data.startsWith("b64:")).toBe(true);
    expect(data).not.toContain("12");
    expect(decodeSolution(b, data)).toEqual(
      new Map([
        [3, "hedge"],
        [12, "hedge"],
        [30, "hedge"],
      ]),
    );
  });

  it("verifies the claimed score", () => {
    const b = lvl();
    const placements = new Map([
      [13, "hedge"],
      [22, "hedge"],
      [31, "hedge"],
    ]);
    const s = score(b, route(b, placements));
    const data = encodeSolution(b, placements);
    expect(verifySolution(b, solution(data, s))).toEqual({ ok: true, score: s });
    expect(verifySolution(b, solution(data, s + 1))).toMatchObject({ ok: false });
  });

  it("rejects tampered, over-budget or foreign data", () => {
    const b = lvl();
    expect(verifySolution(b, solution("b64:!!!", 1))).toMatchObject({ ok: false });
    expect(verifySolution(b, solution("b64:AAAA", 1))).toMatchObject({ ok: false });
    const tooMany = encodeSolution(
      b,
      new Map([
        [1, "hedge"],
        [2, "hedge"],
        [3, "hedge"],
        [4, "hedge"],
      ]),
    );
    const r = verifySolution(b, solution(tooMany, 0));
    expect(r.ok ? "" : r.reason).toMatch(/budget/);
  });
});
