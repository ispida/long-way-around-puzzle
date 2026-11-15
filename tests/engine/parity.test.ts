/**
 * Differential parity with the prototype on thousands of random hedge
 * layouts per level. The prototype still has the old hive rule (fewest steps, hives only break ties);
 * since the hive rule change the animal saves as little as it can. So wherever the prototype's route
 * passes no hive both must agree exactly, and otherwise the new score lies between the prototype's
 * steps and its score (never more food saved, never fewer steps than the shortest route).
 */
import { describe, expect, it } from "vitest";
import { parseLevel, route, score } from "@engine/index";
import { createRng, randInt } from "@engine/search/rng";
import * as proto from "../fixtures/prototype-engine.js";
import { board, content, hedges } from "./helpers";

interface ProtoResult {
  open: boolean;
  steps: number;
  hives: number;
  dist: number;
}
const protoParse = proto.parse as (map: string[]) => { n: number };
const protoRoute = proto.route as (L: unknown, hedge: Uint8Array) => ProtoResult;
const protoCanHedge = proto.canHedge as (L: unknown, i: number) => boolean;

const LAYOUTS_PER_LEVEL = 2000;

describe("parity with the prototype engine", () => {
  const levels = content().levels.filter((l) => /^lvl0[1-8]$/.test(l.id));

  it("has the 8 prototype levels", () => {
    expect(levels.map((l) => l.id)).toEqual([
      "lvl01",
      "lvl02",
      "lvl03",
      "lvl04",
      "lvl05",
      "lvl06",
      "lvl07",
      "lvl08",
    ]);
  });

  it("matches the documented start scores", () => {
    const starts = levels.map((l) => {
      const b = parseLevel(content().registry, l);
      return score(b, route(b));
    });
    expect(starts).toEqual([12, 29, 14, 11, 11, 14, 9, 8]);
  });

  for (const [k, level] of levels.entries()) {
    it(`${level.id} (${level.name}): ${LAYOUTS_PER_LEVEL} random layouts`, () => {
      const b = parseLevel(content().registry, level);
      const L = protoParse(level.map);
      const cand: number[] = [];
      for (let i = 0; i < L.n; i++) if (protoCanHedge(L, i)) cand.push(i);
      const budget = level.pieces.hedge ?? 0;
      const rng = createRng(1000 + k);
      let cutOffs = 0;
      let throughHive = 0;

      for (let t = 0; t < LAYOUTS_PER_LEVEL; t++) {
        // Layout sizes go a little over budget to exercise more cut-offs.
        const size = randInt(rng, budget + 4);
        const cells = new Set<number>();
        while (cells.size < Math.min(size, cand.length)) cells.add(cand[randInt(rng, cand.length)] ?? 0);

        const mask = new Uint8Array(L.n);
        for (const c of cells) mask[c] = 1;
        const want = protoRoute(L, mask);
        const got = route(b, new Map([...cells].map((c) => [c, "hedge"])));
        const hives = got.visits.hive ?? 0;

        const ctx = `${level.id} layout #${t} [${[...cells].sort((x, y) => x - y).join(",")}]`;
        if (want.hives === 0) {
          expect({ open: got.open, steps: got.steps, hives, score: score(b, got) }, ctx).toEqual({
            open: want.open,
            steps: want.steps,
            hives: want.hives,
            score: want.dist,
          });
        } else {
          expect(got.open, ctx).toBe(want.open);
          expect(score(b, got), ctx).toBeLessThanOrEqual(want.dist);
          expect(score(b, got), ctx).toBeGreaterThanOrEqual(want.steps);
          throughHive++;
        }
        if (!want.open) cutOffs++;
      }
      // Sanity: the random layouts must cover both open and cut-off boards.
      expect(cutOffs).toBeGreaterThan(0);
      expect(cutOffs).toBeLessThan(LAYOUTS_PER_LEVEL);
      // Most layouts are compared exactly, also on the levels with hives.
      expect(throughHive).toBeLessThan(LAYOUTS_PER_LEVEL / 2);
    });
  }

  it("matches the rulebook boards", () => {
    const hive = board(["...Q...", "B.....H", "......."]);
    expect(
      score(
        hive,
        route(
          hive,
          hedges(hive, [
            [3, 1],
            [3, 2],
          ]),
        ),
      ),
    ).toBe(13);

    const slope = board([".......", "B..<..H", "...T..."]);
    const r = route(slope);
    expect(r.steps).toBe(8);

    const field = board([".......", "B.....H", ".......", "......."]);
    const serp = route(
      field,
      hedges(field, [
        [2, 0],
        [2, 1],
        [2, 2],
        [4, 1],
        [4, 2],
        [4, 3],
      ]),
    );
    expect(serp.steps).toBe(12);
  });
});
