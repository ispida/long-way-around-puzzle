import { describe, expect, it } from "vitest";
import { BEHAVIORS } from "@engine/behaviors";
import { buildRegistry, ContentError, LevelError, parseLevel } from "@engine/index";
import { BEHAVIOR_TYPES } from "@shared/schemas";
import { board, makeLevel, registry } from "./helpers";

describe("registry", () => {
  it("maps characters to tiles", () => {
    const r = registry();
    const id = (c: string) => r.tiles[r.tileByChar.get(c) ?? -1]?.id;
    expect([id("."), id("T"), id("m"), id("7"), id("^"), id("B"), id("H")]).toEqual([
      "grass",
      "tree",
      "mud",
      "burrow",
      "slope-up",
      "start",
      "food",
    ]);
  });
  it("rejects duplicate characters", () => {
    const { tiles, pieces } = registry();
    const rulesets = [...registry().rulesets.values()];
    const clash = { ...tiles[0]!, id: "clash" };
    expect(() => buildRegistry({ tiles: [...tiles, clash], pieces, rulesets })).toThrow(ContentError);
  });
  it("has a module for every behaviour type in the schema", () => {
    expect(Object.keys(BEHAVIORS).sort()).toEqual([...BEHAVIOR_TYPES].sort());
  });
});

describe("parseLevel", () => {
  it("finds start, goals, costs and placeable cells", () => {
    const b = board(["B.m", "T.H"], { hedge: 2 });
    expect(b.start).toBe(0);
    expect(b.goals).toEqual([5]);
    expect([...b.cost]).toEqual([1, 1, 3, 1, 1, 1]);
    expect([...b.walkable]).toEqual([1, 1, 1, 0, 1, 1]);
    expect(b.pieceIds).toEqual(["hedge"]);
    expect([...(b.placeable[0] ?? [])]).toEqual([0, 1, 0, 0, 1, 0]);
  });
  it("pairs tunnels by character and reads one-way directions and bonuses", () => {
    const b = board(["B1.2", "2.1Q", ">v<^", "...H"]);
    expect(b.partner[1]).toBe(6);
    expect(b.partner[6]).toBe(1);
    expect(b.partner[3]).toBe(4);
    expect([...b.oneWay.slice(8, 12)]).toEqual([2, 3, 4, 1]);
    expect(b.bonus[7]).toBe(5);
  });
  it("throws LevelError with the cell for broken levels", () => {
    const r = registry();
    expect(() => parseLevel(r, makeLevel(["B.X.H"]))).toThrow(/unknown map character "X"/);
    expect(() => parseLevel(r, makeLevel(["..H"]))).toThrow(/no start/);
    expect(() => parseLevel(r, makeLevel(["B.B.H"]))).toThrow(/more than one start/);
    try {
      parseLevel(r, makeLevel(["B.1.H"]));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(LevelError);
      expect((e as LevelError).cell).toBe(2);
    }
  });
});
