import { describe, expect, it } from "vitest";
import { canPlace, createRng, parseLevel, route, routeFast, score } from "@engine/index";
import { board, content, hedges, registry } from "./helpers";

const run = (map: string[], h: [number, number][] = []) => {
  const b = board(map);
  const r = route(b, hedges(b, h));
  return { ...r, score: score(b, r), b };
};

describe("route", () => {
  it("walks a straight line", () => {
    const r = run(["B...H"]);
    expect([r.open, r.steps, r.score]).toEqual([true, 4, 4]);
    expect(r.path.map((p) => p.cell)).toEqual([0, 1, 2, 3, 4]);
    expect(r.path[0]?.via).toBe("start");
  });
  it("goes around mud when that is shorter, wades when forced", () => {
    expect(run(["B.m.H", "....."]).steps).toBe(6); // through (1+3+1+1) and around (6) tie at 6
    expect(run(["B.mm.H", "......"]).steps).toBe(7); // around (7) beats through (1+3+3+1+1 = 9)
    expect(
      run(
        ["B.mm.H", "......"],
        [
          [1, 1],
          [2, 1],
          [3, 1],
          [4, 1],
        ],
      ).steps,
    ).toBe(9);
  });
  it("uses tunnels: entering the hole costs 1, the hop costs 1", () => {
    // B -> hole (1) -> hop to the other hole (1) -> down to the honey (1)
    const r = run(["B1TTT", "..TT1", "....H"]);
    expect(r.steps).toBe(3);
    expect(r.path.map((p) => p.via)).toEqual(["start", "step", "tunnel", "step"]);
  });
  it("respects one-way tiles in both directions", () => {
    expect(run(["B<H", "..."]).steps).toBe(4); // can't cross a left slope going right
    expect(run(["B>H"]).steps).toBe(2);
    expect(run(["B.H", ".^."]).steps).toBe(2);
  });
  it("avoids a hive on equal steps, but is forced through it by hedges", () => {
    const free = run(["...Q...", "B.....H", "......."]);
    expect([free.steps, free.bonus, free.score]).toEqual([6, 0, 6]);
    const forced = run(
      ["...Q...", "B.....H", "......."],
      [
        [3, 1],
        [3, 2],
      ],
    );
    expect([forced.steps, forced.bonus, forced.score, forced.visits.hive]).toEqual([8, 5, 13, 1]);
  });
  it("saves as little as it can: walks up to 5 extra steps around a hive", () => {
    // Through the hive: 8 steps + 5 = 13. Around under the trees: 10, then 14 with two more rows.
    const around = run(["...Q...", "B..T..H", "...T...", "......."]);
    expect([around.steps, around.bonus, around.score]).toEqual([10, 0, 10]);
    const through = run(["...Q...", "B..T..H", "...T...", "...T...", "...T...", "......."]);
    expect([through.steps, through.bonus, through.score, through.visits.hive]).toEqual([8, 5, 13, 1]);
  });
  it("takes the way around when it scores the same as the way through", () => {
    // Two hives: 8 steps + 10 = 18, the same as the 18 steps around: it avoids the bees.
    const trees = Array.from({ length: 6 }, () => "...T...");
    const tie = run(["...QQ..", "B..T..H", ...trees.slice(1), "......."]);
    expect([tie.steps, tie.bonus, tie.score]).toEqual([18, 0, 18]);
    const longer = run(["...QQ..", "B..T..H", ...trees, "......."]);
    expect([longer.steps, longer.bonus, longer.score]).toEqual([8, 10, 18]);
  });
  it("goes around both hives of the reported level 7 layout", () => {
    // Through both hives: 21 steps + 10 = 31; around them: 27 steps, so it scores 27.
    const r = run(
      [
        "....T......",
        "....T..Q...",
        "....T......",
        "B..........",
        "....T.....H",
        "....T......",
        "....T..Q...",
        "....T......",
      ],
      [
        [7, 2],
        [6, 3],
        [10, 3],
        [5, 4],
        [9, 4],
        [8, 5],
      ],
    );
    expect([r.steps, r.bonus, r.score]).toEqual([27, 0, 27]);
  });
  it("prefers a hive-free route even when it means the other side", () => {
    const r = run(["..Q..", "B...H", "..Q.."], [[2, 1]]);
    expect([r.steps, r.bonus]).toEqual([6, 5]); // both detours pass a hive
  });
  it("heads for the nearest goal", () => {
    const r = run(["H....B..H"]);
    expect(r.steps).toBe(3);
    expect(r.path.at(-1)?.cell).toBe(8);
  });
  it("scores 0 when cut off", () => {
    const cut = run(
      ["B.T.H", "..T.."],
      [
        [1, 1],
        [1, 0],
      ],
    );
    expect([cut.open, cut.score]).toEqual([false, 0]);
  });
  it("draws one fixed route among equal ones (up, right, down, left order)", () => {
    const a = run(["B..", "...", "..H"]).path.map((p) => p.cell);
    const b2 = run(["B..", "...", "..H"]).path.map((p) => p.cell);
    expect(a).toEqual(b2);
  });
});

describe("route speed", () => {
  it("stays far below 10 ms on a 20×20 board (loose guard; see npm run bench)", () => {
    const rows = Array.from({ length: 20 }, (_, y) =>
      Array.from({ length: 20 }, (_, x) =>
        x === 0 && y === 0 ? "B" : x === 19 && y === 19 ? "H" : (x * 7 + y * 3) % 11 === 0 ? "m" : ".",
      ).join(""),
    );
    const b = board(rows);
    route(b);
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) route(b);
    expect((performance.now() - t0) / 200).toBeLessThan(10);
  });
});

describe("routeFast (the search's allocation-free route)", () => {
  it("gives the same score and cells as route() on every level and many random layouts", () => {
    const rng = createRng(11);
    for (const level of content().levels) {
      const b = parseLevel(registry(), level);
      for (let t = 0; t < 300; t++) {
        const cells: number[] = [];
        for (let i = 0; i < 12; i++) {
          const c = Math.floor(rng() * b.n);
          if (canPlace(b, c, "hedge") && !cells.includes(c)) cells.push(c);
        }
        const r = route(b, new Map(cells.map((c) => [c, "hedge"])));
        const path: number[] = [];
        const v = routeFast(
          b,
          cells,
          cells.map(() => 0),
          path,
        );
        expect(v).toBe(r.open ? r.steps + r.bonus : -1);
        expect(path).toEqual(r.path.map((p) => p.cell));
      }
    }
  });
});
