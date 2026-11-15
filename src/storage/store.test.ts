import { describe, expect, it } from "vitest";
import { createStore, STORAGE_KEY, type StorageLike, type Submission } from "./store";

class Fake implements StorageLike {
  map = new Map<string, string>();
  getItem = (k: string) => this.map.get(k) ?? null;
  setItem = (k: string, v: string) => void this.map.set(k, v);
}
const sub = (score: number, at = "2026-10-03T10:00:00Z"): Submission => ({
  score,
  steps: score,
  bonus: 0,
  placements: [[12, "hedge"]],
  at,
});

describe("store", () => {
  it("counts the first submission and keeps later ones as attempts", () => {
    const s = createStore(new Fake());
    expect(s.submit("lvl01", sub(12))).toEqual({ counted: true });
    expect(s.submit("lvl01", sub(14))).toEqual({ counted: false });
    expect(s.submit("lvl01", sub(9))).toEqual({ counted: false });
    const p = s.level("lvl01");
    expect(p.counted?.score).toBe(12);
    expect(p.attempts.map((a) => a.score)).toEqual([14, 9]);
    expect(p.best?.score).toBe(14);
    expect(p.last?.score).toBe(9);
  });

  it("remembers the best layout tried so far, across reloads, without counting it as played", () => {
    const fake = new Fake();
    const s = createStore(fake);
    expect(s.tried("lvl02", { score: 20, placements: [[5, "hedge"]] })).toBe(true);
    expect(s.tried("lvl02", { score: 18, placements: [[6, "hedge"]] })).toBe(false);
    expect(s.tried("lvl02", { score: 20, placements: [[7, "hedge"]] })).toBe(false); // ties keep the first
    expect(s.tried("lvl02", { score: 25, placements: [[8, "hedge"]] })).toBe(true);
    expect(createStore(fake).level("lvl02").bestTry).toEqual({ score: 25, placements: [[8, "hedge"]] });
    expect(s.played()).toEqual([]);
    expect(s.cleared("lvl02")).toBe(false);
  });

  it("counts a better submission from before bestTry existed as the best layout", () => {
    const s = createStore(new Fake());
    s.submit("lvl01", sub(14));
    expect(s.level("lvl01").bestTry).toEqual({ score: 14, placements: [[12, "hedge"]] });
    expect(s.tried("lvl01", { score: 13, placements: [] })).toBe(false);
  });

  it("persists across instances and remembers the theme", () => {
    const storage = new Fake();
    const a = createStore(storage);
    a.submit("lvl02", sub(30));
    a.setTheme("panda");
    const b = createStore(storage);
    expect(b.level("lvl02").counted?.score).toBe(30);
    expect(b.theme()).toBe("panda");
  });

  it("keeps at most 50 attempts, never dropping the counted one", () => {
    const s = createStore(new Fake());
    for (let i = 0; i < 60; i++) s.submit("lvl01", sub(i));
    const p = s.level("lvl01");
    expect(p.counted?.score).toBe(0);
    expect(p.attempts).toHaveLength(50);
    expect(p.attempts[0]?.score).toBe(10);
  });

  it("starts fresh on corrupted data", () => {
    const storage = new Fake();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(createStore(storage).level("lvl01")).toEqual({ attempts: [] });
    storage.setItem(STORAGE_KEY, JSON.stringify({ v: 99 }));
    expect(createStore(storage).theme()).toBeUndefined();
  });

  it("works without storage and when writes fail", () => {
    const none = createStore(null);
    expect(none.persistent).toBe(false);
    none.submit("lvl01", sub(5));
    expect(none.level("lvl01").counted?.score).toBe(5);

    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const s = createStore(full);
    expect(() => s.submit("lvl01", sub(5))).not.toThrow();
    expect(s.level("lvl01").counted?.score).toBe(5);
  });
});

describe("campaign versions", () => {
  it("archives campaign progress from an older campaign, keeps dailies and settings", () => {
    const fake = new Fake();
    const s = createStore(fake);
    s.setTheme("panda");
    s.submit("lvl01", sub(12));
    s.submit("2026-10-06", sub(30));
    s.useCampaign(1);
    expect(s.level("lvl01").counted?.score).toBe(12);

    s.useCampaign(2);
    expect(s.level("lvl01").counted).toBeUndefined();
    expect(s.level("2026-10-06").counted?.score).toBe(30);
    expect(s.theme()).toBe("panda");
    const stored = JSON.parse(fake.map.get(STORAGE_KEY) ?? "{}") as {
      campaignVersion: number;
      archive: Record<string, Record<string, unknown>>;
    };
    expect(stored.campaignVersion).toBe(2);
    expect(Object.keys(stored.archive["campaign-v1"] ?? {})).toEqual(["lvl01"]);

    // The new campaign's progress stays; reloading with the same version changes nothing.
    s.submit("lvl01", sub(40));
    const again = createStore(fake);
    again.useCampaign(2);
    expect(again.level("lvl01").counted?.score).toBe(40);
  });

  it("archives a level played under other rules, once, and leaves the rest", () => {
    const fake = new Fake();
    const s = createStore(fake);
    s.submit("lvl07", sub(31));
    s.submit("lvl08", sub(20));
    s.useRules("lvl08", "");
    s.useRules("lvl07", "bonus2");
    expect(s.level("lvl07").counted).toBeUndefined();
    expect(s.cleared("lvl07")).toBe(true);
    expect(s.level("lvl08").counted?.score).toBe(20);
    // The new Submit counts and survives a reload with the same rules.
    s.submit("lvl07", sub(27));
    const again = createStore(fake);
    again.useRules("lvl07", "bonus2");
    expect(again.level("lvl07").counted?.score).toBe(27);
    const stored = JSON.parse(fake.map.get(STORAGE_KEY) ?? "{}") as {
      archive: Record<string, Record<string, { counted: { score: number } }>>;
      levelRules: Record<string, string>;
    };
    expect(stored.archive["rules-bonus2"]?.lvl07?.counted.score).toBe(31);
    expect(stored.levelRules).toEqual({ lvl07: "bonus2" });
  });

  it("a new player on campaign 2 has nothing to archive", () => {
    const fake = new Fake();
    createStore(fake).useCampaign(2);
    const stored = JSON.parse(fake.map.get(STORAGE_KEY) ?? "{}") as {
      archive: object;
      campaignVersion: number;
    };
    expect(stored).toMatchObject({ campaignVersion: 2, archive: {} });
  });
});
