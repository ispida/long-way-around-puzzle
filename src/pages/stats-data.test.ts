import { describe, expect, it } from "vitest";
import { createStore, type Submission } from "@storage/store";
import { dailyStats } from "./stats-data";

const sub = (score: number, at: string, optimum?: number): Submission => ({
  score,
  steps: score,
  bonus: 0,
  placements: [],
  at,
  ...(optimum !== undefined ? { optimum } : {}),
});

describe("daily stats", () => {
  it("lists counted dailies in date order and counts optimums; campaign levels and practice are ignored", () => {
    const s = createStore(null);
    s.submit("lvl01", sub(14, "2026-10-01T10:00:00Z"));
    s.submit("2026-10-05", sub(12, "2026-10-06T09:00:00Z", 12));
    s.submit("2026-10-01", sub(10, "2026-10-01T08:00:00Z", 12));
    s.submit("2026-10-05", sub(3, "2026-10-06T09:30:00Z", 12)); // practice: not counted

    expect(dailyStats(s)).toEqual({
      played: [
        { date: "2026-10-01", score: 10, optimum: 12 },
        { date: "2026-10-05", score: 12, optimum: 12 },
      ],
      perfect: 1,
    });
    expect(dailyStats(createStore(null))).toEqual({ played: [], perfect: 0 });
  });
});

describe("optimum gaps", () => {
  it("buckets counted dailies by how far they stayed below the optimum", async () => {
    const { optimumGaps } = await import("./stats-data");
    const d = (score: number, optimum?: number) => ({
      date: "2026-10-01",
      score,
      ...(optimum !== undefined ? { optimum } : {}),
    });
    expect(optimumGaps([])).toEqual([0, 0, 0, 0]);
    expect(optimumGaps([d(12, 12), d(13, 12), d(11, 12), d(10, 12), d(9, 12), d(1, 12), d(5)])).toEqual([
      2, 1, 1, 2,
    ]);
  });
});
