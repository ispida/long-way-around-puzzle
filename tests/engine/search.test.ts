import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createSearch, isValidPlacement, parseLevel, route, score } from "@engine/index";
import { content } from "./helpers";

/**
 * "Best found by search" in the original prototype notes. Targets are never lowered, except by a
 * rule change: lvl06's 30 needed the old hive tie rule, 27 is its proven optimum since the hive rule change.
 */
const HANDOFF_BEST: Record<string, number> = {
  lvl01: 14,
  lvl02: 41,
  lvl03: 24,
  lvl04: 22,
  lvl05: 25,
  lvl06: 27,
  lvl07: 31,
  lvl08: 41,
};
const ITERATIONS = 40_000;

describe("search", () => {
  const boards = () => content().levels.map((l) => parseLevel(content().registry, l));

  it("is deterministic for a seed", () => {
    const b = boards()[1]!;
    const run = () => {
      const s = createSearch(b, { seed: 7 });
      s.step(3000);
      return s.best();
    };
    expect(run()).toEqual(run());
  });

  it("produces exactly the same layouts as before the search speed-up", () => {
    // Fingerprint of best layout, score, route and visits for seed 5 after 6000 iterations on every
    // level. Speed work must not change it; a deliberate change to the search or the rules updates it
    //.
    const out = boards().map((b) => {
      const s = createSearch(b, { seed: 5 });
      s.step(6000);
      const best = s.best();
      const r = route(b, best.placements);
      return [b.level.id, best.score, [...best.placements], r.path, r.visits];
    });
    expect(createHash("sha256").update(JSON.stringify(out)).digest("hex")).toBe(
      "49902e99331e2112d5e30c10a56d3d65629413a90d556eb2b3017c76668aa363",
    );
  }, 30_000);

  it("only returns valid layouts", () => {
    for (const b of boards()) {
      const s = createSearch(b, { seed: 3 });
      s.step(2000);
      expect(isValidPlacement(b, s.best().placements), b.level.id).toBe(true);
    }
  });

  it("starts from a given layout and never gets worse than it", () => {
    const b = boards()[0]!;
    const start = new Map([[10, "hedge"]]); // grass at column 2, row 2
    const startScore = score(b, route(b, start));
    const s = createSearch(b, { seed: 1, start });
    expect(s.best()).toEqual({ placements: start, score: startScore });
    s.step(500);
    expect(s.best().score).toBeGreaterThanOrEqual(startScore);
  });

  for (const [id, target] of Object.entries(HANDOFF_BEST)) {
    it(`reaches the prototype's best score on ${id} (${target})`, () => {
      const b = boards().find((x) => x.level.id === id)!;
      const s = createSearch(b, { seed: 1 });
      s.step(ITERATIONS);
      expect(s.best().score).toBeGreaterThanOrEqual(target);
      // The search never beats a proven optimum.
      const sol = b.level.solution;
      expect(sol?.proven, `${id} has a proven solution`).toBe(true);
      expect(s.best().score).toBeLessThanOrEqual(sol?.score ?? -1);
    }, 30_000);
  }
});
