import { describe, expect, it } from "vitest";
import { createStore } from "@storage/store";
import { isUnlocked } from "./progress";

describe("isUnlocked", () => {
  const campaign = { levels: ["lvl01", "lvl02", "lvl03"], unlock: "sequential" as const };
  const sub = { score: 5, steps: 5, bonus: 0, placements: [], at: "2026-10-03T10:00:00Z" };

  it("opens level 1, then each level after the previous one is submitted", () => {
    const store = createStore(null);
    expect([0, 1, 2].map((i) => isUnlocked(campaign, i, store))).toEqual([true, false, false]);
    store.submit("lvl01", sub);
    expect([0, 1, 2].map((i) => isUnlocked(campaign, i, store))).toEqual([true, true, false]);
  });
  it("keeps the next level open when a level's rules changed", () => {
    const store = createStore(null);
    store.submit("lvl01", sub);
    store.useRules("lvl01", "bonus2");
    expect(store.level("lvl01").counted).toBeUndefined(); // it may be submitted again
    expect(isUnlocked(campaign, 1, store)).toBe(true);
  });
  it("opens everything with unlock: all, nothing outside the campaign", () => {
    const store = createStore(null);
    expect(isUnlocked({ ...campaign, unlock: "all" }, 2, store)).toBe(true);
    expect(isUnlocked(campaign, 3, store)).toBe(false);
    expect(isUnlocked(campaign, -1, store)).toBe(false);
  });
});
