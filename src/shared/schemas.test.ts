import { describe, expect, it } from "vitest";
import { BEHAVIOR_TYPES, CampaignSchema, LevelSchema, PieceSchema, ThemeSchema, TileSchema } from "./schemas";

const level = {
  schema: 1,
  id: "c-01-first-hedges",
  name: "First hedges",
  tag: "Basics",
  text: "The {animal} walks around the trees.",
  map: ["B..T....H", "...T....."],
  pieces: { hedge: 3 },
};

describe("TileSchema", () => {
  it("fills defaults for a simple tile", () => {
    const t = TileSchema.parse({
      id: "mud",
      chars: ["m"],
      walkable: true,
      cost: 3,
      editor: { group: "terrain", order: 30 },
    });
    expect(t.accepts).toEqual([]);
    expect(t.behaviors).toEqual([]);
  });
  it("rejects unknown behaviours and unknown fields", () => {
    const base = { id: "x", chars: ["x"], walkable: true, editor: { group: "special", order: 1 } };
    expect(TileSchema.safeParse({ ...base, behaviors: [{ type: "teleport" }] }).success).toBe(false);
    expect(TileSchema.safeParse({ ...base, colour: "red" }).success).toBe(false);
  });
  it("rejects multi-character map symbols", () => {
    expect(
      TileSchema.safeParse({ id: "x", chars: ["xy"], walkable: true, editor: { group: "terrain", order: 1 } })
        .success,
    ).toBe(false);
  });
  it("knows the behaviour types", () => {
    expect(BEHAVIOR_TYPES).toEqual(["oneWay", "tunnel", "bonus"]);
  });
});

describe("PieceSchema", () => {
  it("accepts block and setCost effects", () => {
    expect(
      PieceSchema.safeParse({ id: "hedge", effect: { type: "block" }, editor: { order: 10 } }).success,
    ).toBe(true);
    expect(
      PieceSchema.safeParse({ id: "puddle", effect: { type: "setCost", cost: 3 }, editor: { order: 20 } })
        .success,
    ).toBe(true);
  });
});

describe("LevelSchema", () => {
  it("accepts a valid level and applies defaults", () => {
    const l = LevelSchema.parse(level);
    expect(l.rules).toBe("default");
    expect(l.modifiers).toEqual([]);
  });
  it("rejects ragged maps", () => {
    const r = LevelSchema.safeParse({ ...level, map: ["B..H", "..."] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["map"]);
  });
  it("validates solutions", () => {
    const solution = {
      score: 14,
      proven: true,
      data: "b64:AAAA",
      method: "cp-sat",
      solvedAt: "2026-10-03",
      engineVersion: 1,
    };
    expect(LevelSchema.safeParse({ ...level, solution }).success).toBe(true);
    expect(
      LevelSchema.safeParse({ ...level, solution: { ...solution, solvedAt: "03-10-2026" } }).success,
    ).toBe(false);
  });
});

describe("ThemeSchema and CampaignSchema", () => {
  it("accepts a theme that extends another", () => {
    const t = ThemeSchema.parse({
      id: "icebear",
      name: "Ice bear & fish",
      extends: "panda",
      words: { animal: "ice bear" },
    });
    expect(t.tileSize).toBe(128);
  });
  it("caps the campaign at 20 levels", () => {
    const ids = Array.from({ length: 21 }, (_, i) => `lvl${i + 1}`);
    expect(CampaignSchema.safeParse({ levels: ids, unlock: "sequential" }).success).toBe(false);
    expect(CampaignSchema.safeParse({ levels: ids.slice(0, 20), unlock: "sequential" }).success).toBe(true);
  });
});
