import { describe, expect, it } from "vitest";
import { decodeSolution, parseLevel, verifySolution } from "@engine/index";
import type { LevelJson } from "@shared/types";
import { campaignId, planAdd, renameLevel } from "./add-level";
import { loadContent } from "./content-io";

const { registry, fixtures: levels } = loadContent();
const campaign = { levels: levels.map((l) => l.id), unlock: "sequential" as const, version: 1 };
const byId = new Map(levels.map((l) => [l.id, l]));
/** A level file with its own id, its solution encoded for that id. */
const exported = (): LevelJson => ({
  ...renameLevel(registry, byId.get("lvl02")!, "serpentine-2"),
  name: "Serpentine again",
});

describe("add-level", () => {
  it("renaming re-encodes the stored solution, so it still decodes to the same layout", () => {
    const original = byId.get("lvl05")!;
    const renamed = renameLevel(registry, original, "lvl06");
    expect(renamed.id).toBe("lvl06");
    expect(renamed.solution!.data).not.toBe(original.solution!.data);
    const before = decodeSolution(parseLevel(registry, original), original.solution!.data);
    const after = decodeSolution(parseLevel(registry, renamed), renamed.solution!.data);
    expect([...after]).toEqual([...before]);
    expect(verifySolution(parseLevel(registry, renamed), renamed.solution!)).toMatchObject({ ok: true });
  });

  it("appends at the end by default", () => {
    const plan = planAdd(registry, campaign, byId, exported());
    expect(plan.id).toBe("lvl09");
    expect(plan.campaign.levels.at(-1)).toBe("lvl09");
    expect([...plan.files.keys()]).toEqual(["lvl09.json"]);
    expect(plan.files.get("lvl09.json")!.name).toBe("Serpentine again");
    expect(plan.moved).toEqual([]);
  });

  it("inserts at a position and renumbers the following levels", () => {
    const plan = planAdd(registry, campaign, byId, exported(), { position: 3 });
    expect(plan.campaign.levels).toEqual(Array.from({ length: 9 }, (_, i) => campaignId(i + 1)));
    expect(plan.files.get("lvl03.json")!.name).toBe("Serpentine again");
    expect(plan.files.get("lvl04.json")!.name).toBe(byId.get("lvl03")!.name);
    expect(plan.files.get("lvl09.json")!.name).toBe(byId.get("lvl08")!.name);
    expect(plan.files.has("lvl02.json")).toBe(false); // unchanged levels are not rewritten
    expect(plan.moved[0]).toBe("lvl03 → lvl04");
  });

  it("replaces a level in place, and refuses impossible positions", () => {
    const plan = planAdd(registry, campaign, byId, exported(), { position: 2, replace: true });
    expect([...plan.files.keys()]).toEqual(["lvl02.json"]);
    expect(plan.campaign.levels).toHaveLength(8);
    expect(() => planAdd(registry, campaign, byId, exported(), { position: 12 })).toThrow(/position/);
    expect(() => planAdd(registry, campaign, byId, exported(), { replace: true })).toThrow(/--replace/);
    const full = { ...campaign, levels: Array.from({ length: 20 }, (_, i) => campaignId(i + 1)) };
    const all = new Map(full.levels.map((id) => [id, { ...exported(), id }]));
    expect(() => planAdd(registry, full, all, exported())).toThrow(/20 levels/);
  });
});
