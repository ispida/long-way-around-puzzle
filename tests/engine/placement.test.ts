import { describe, expect, it } from "vitest";
import { budgetLeft, canPlace, isValidPlacement, togglePlacement } from "@engine/index";
import { board } from "./helpers";

describe("placement", () => {
  const b = board(["B..m", "T.QH"], { hedge: 2 });

  it("allows hedges on grass only, never on start or goal", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((c) => canPlace(b, c, "hedge"))).toEqual([
      false,
      true,
      true,
      false,
      false,
      true,
      false,
      false,
    ]);
    expect(canPlace(b, 1, "puddle")).toBe(false);
  });

  it("toggles within the budget and never mutates the input", () => {
    const empty = new Map<number, string>();
    const one = togglePlacement(b, empty, 1, "hedge");
    expect(one.ok).toBe(true);
    expect(empty.size).toBe(0);
    const two = togglePlacement(b, one.placements, 2, "hedge");
    const three = togglePlacement(b, two.placements, 5, "hedge");
    expect(three).toMatchObject({ ok: false, reason: "no-budget" });
    expect(budgetLeft(b, two.placements, "hedge")).toBe(0);
    const removed = togglePlacement(b, two.placements, 1, "hedge");
    expect([...removed.placements.keys()]).toEqual([2]);
    expect(togglePlacement(b, empty, 3, "hedge")).toMatchObject({ ok: false, reason: "not-allowed" });
  });

  it("checks whole layouts", () => {
    expect(
      isValidPlacement(
        b,
        new Map([
          [1, "hedge"],
          [2, "hedge"],
        ]),
      ),
    ).toBe(true);
    expect(
      isValidPlacement(
        b,
        new Map([
          [1, "hedge"],
          [2, "hedge"],
          [5, "hedge"],
        ]),
      ),
    ).toBe(false);
    expect(isValidPlacement(b, new Map([[6, "hedge"]]))).toBe(false);
  });
});
