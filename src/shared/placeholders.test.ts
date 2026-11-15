import { describe, expect, it } from "vitest";
import { fillWords, placeholderKeys } from "./placeholders";

const words = { animal: "bear", food: "honey", mud: "Mud" };

describe("placeholders", () => {
  it("lists keys once, in order", () => {
    expect(placeholderKeys("The {animal} wants {food}. {animal|cap}! {mud|lower}")).toEqual([
      "animal",
      "food",
      "mud",
    ]);
  });
  it("fills words with filters", () => {
    expect(fillWords("Every {mud|lower} tile slows the {animal}. {animal|cap} hates {mud}.", words)).toBe(
      "Every mud tile slows the bear. Bear hates Mud.",
    );
  });
  it("leaves unknown words visible", () => {
    expect(fillWords("A {unicorn} appears", words)).toBe("A {unicorn} appears");
  });
});
