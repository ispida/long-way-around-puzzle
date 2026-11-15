import { describe, expect, it } from "vitest";
import type { Submission } from "@storage/store";
import { localCounts, scoreBars } from "./leaderboard-data";
import { nextPhase } from "./phase";

describe("phase machine", () => {
  it("walks only with an open route", () => {
    expect(nextPhase("placing", "submit", true)).toBe("walking");
    expect(nextPhase("placing", "submit", false)).toBe("placing");
    expect(nextPhase("walking", "walked")).toBe("result");
    expect(nextPhase("result", "playAgain")).toBe("placing");
  });
  it("lets the player resubmit or edit straight from the result", () => {
    expect(nextPhase("result", "submit", true)).toBe("walking");
    expect(nextPhase("result", "submit", false)).toBe("result");
    expect(nextPhase("result", "edit")).toBe("placing");
  });
  it("ignores events that don't fit the phase", () => {
    expect(nextPhase("walking", "submit")).toBe("walking");
    expect(nextPhase("placing", "walked")).toBe("placing");
  });
});

describe("leaderboard histogram", () => {
  const describeBar = (range: string, n: number) => `${range}:${n}`;

  it("uses the counted score as the local fallback", () => {
    const s: Submission = { score: 12, steps: 12, bonus: 0, placements: [], at: "2026-10-03T10:00:00Z" };
    expect(localCounts({ counted: s, attempts: [] })).toEqual([[12, 1]]);
    expect(localCounts({ attempts: [] })).toEqual([]);
  });
  it("has a bar for every score in between, empty ones at 0, and marks the current score", () => {
    const bars = scoreBars(
      [
        [16, 2],
        [24, 1],
        [26, 1],
      ],
      26,
      describeBar,
    );
    expect(bars.map((b) => b.count)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1]);
    expect(bars.map((b) => b.label)).toEqual([
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
      "26",
    ]);
    expect(bars.filter((b) => b.current).map((b) => b.label)).toEqual(["26"]);
    expect(bars[1]?.title).toBe("17:0");
  });
  it("gives each bar an equal range of scores beyond 24, labelling only every few", () => {
    const counts = Array.from({ length: 30 }, (_, i) => [i * 3, 1] as [number, number]);
    const bars = scoreBars(counts, 87, describeBar);
    // Scores 0–87: 88 of them, 4 per bar.
    expect(bars).toHaveLength(22);
    expect(bars[0]).toMatchObject({ label: "0", count: 2 });
    expect(bars[1]).toMatchObject({ label: "", count: 1 });
    expect(bars[2]).toMatchObject({ label: "8", count: 1 });
    expect(bars[0]?.title).toBe("0–3:2");
    expect(bars.filter((b) => b.label !== "")).toHaveLength(11);
    expect(bars.every((b) => !b.label.includes("–"))).toBe(true);
    expect(bars.at(-1)).toMatchObject({ current: true });
    expect(bars.reduce((n, b) => n + b.count, 0)).toBe(30);
  });
  it("is empty without submissions", () => {
    expect(scoreBars([], undefined, describeBar)).toEqual([]);
  });
});

describe("speech", () => {
  it("never repeats a line twice in a row and uses every line", async () => {
    const { createSpeech } = await import("./speech");
    const lines = ["a", "b", "c", "d"];
    let seed = 1;
    const say = createSpeech(lines, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
    const said = Array.from({ length: 200 }, () => say());
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    expect(new Set(said)).toEqual(new Set(lines));
  });
  it("handles one or no line", async () => {
    const { createSpeech } = await import("./speech");
    expect(createSpeech(["only"])()).toBe("only");
    expect(createSpeech([])()).toBe("");
  });
});
