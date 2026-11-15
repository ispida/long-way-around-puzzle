import { describe, expect, it } from "vitest";
import { buildRegistry, parseLevel, route } from "@engine/index";
import { LevelSchema } from "@shared/schemas";
import { frameAt, STEP_MS, timeline, TUNNEL_MS } from "./animate";
import { cellSize } from "./canvas";
import { cellAt } from "./hit";

describe("hit testing", () => {
  const rect = { left: 10, top: 20, width: 300, height: 200 };
  it("maps pointer positions to cells", () => {
    expect(cellAt(rect, 10, 20, 3, 2)).toBe(0);
    expect(cellAt(rect, 309, 219, 3, 2)).toBe(5);
    expect(cellAt(rect, 160, 130, 3, 2)).toBe(4);
  });
  it("returns null outside", () => {
    expect(cellAt(rect, 9, 50, 3, 2)).toBeNull();
    expect(cellAt(rect, 50, 221, 3, 2)).toBeNull();
    expect(cellAt({ ...rect, width: 0 }, 50, 50, 3, 2)).toBeNull();
  });
});

describe("cell size", () => {
  it("stays between 22 and 88 px", () => {
    expect(cellSize(1000, 9)).toBe(88);
    expect(cellSize(330, 11)).toBe(30);
    expect(cellSize(200, 20)).toBe(20);
    expect(cellSize(336, 16)).toBe(21); // a 360 px phone
  });
});

describe("walk timeline", () => {
  const registry = buildRegistry({
    tiles: [
      {
        id: "grass",
        chars: ["."],
        walkable: true,
        cost: 1,
        accepts: ["hedge"],
        behaviors: [],
        editor: { group: "terrain", order: 1 },
      },
      {
        id: "mud",
        chars: ["m"],
        walkable: true,
        cost: 3,
        accepts: [],
        behaviors: [],
        editor: { group: "terrain", order: 2 },
      },
      {
        id: "hive",
        chars: ["Q"],
        walkable: true,
        cost: 1,
        accepts: [],
        behaviors: [{ type: "bonus", points: 5 }],
        editor: { group: "special", order: 3 },
      },
      {
        id: "burrow",
        chars: ["1"],
        walkable: true,
        cost: 1,
        accepts: [],
        behaviors: [{ type: "tunnel", pairBy: "char", cost: 1 }],
        editor: { group: "special", order: 4 },
      },
      {
        id: "start",
        chars: ["B"],
        walkable: true,
        cost: 1,
        role: "start",
        accepts: [],
        behaviors: [],
        editor: { group: "actor", order: 5 },
      },
      {
        id: "food",
        chars: ["H"],
        walkable: true,
        cost: 1,
        role: "goal",
        accepts: [],
        behaviors: [],
        editor: { group: "actor", order: 6 },
      },
    ],
    pieces: [{ id: "hedge", effect: { type: "block" }, editor: { order: 1 } }],
    rulesets: [{ id: "default", onCutOff: "zero", goal: "nearest", animals: 1, score: "single" }],
  });
  const board = parseLevel(
    registry,
    LevelSchema.parse({
      schema: 1,
      id: "t",
      name: "t",
      tag: "t",
      text: "",
      map: ["BmQ1", "1..H"],
      pieces: { hedge: 1 },
    }),
  );

  it("times steps by cost and counts the score up to the route score", () => {
    const r = route(board);
    const t = timeline(board, r);
    expect(t.gains.reduce((a, b) => a + b, 0)).toBe(r.steps + r.bonus);
    expect(t.durations.every((d) => [0, STEP_MS, STEP_MS * 3, TUNNEL_MS].includes(d))).toBe(true);
    expect(frameAt(t, 0)).toMatchObject({ k: 0, score: 0, done: false });
    expect(frameAt(t, t.total + 1)).toMatchObject({
      k: r.path.length - 1,
      score: r.steps + r.bonus,
      done: true,
    });
  });
});

describe("route badges", () => {
  it("shows the hive's bonus and what mud counts, never on the start", async () => {
    const { badgeFor } = await import("./layers");
    const board = { bonus: Int16Array.from([0, 5, 0, 0]), cost: Uint8Array.from([3, 1, 3, 1]) };
    expect([0, 1, 2, 3].map((c, k) => badgeFor(board, c, k))).toEqual([0, 5, 3, 0]);
  });
});
