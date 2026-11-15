import { describe, expect, it } from "vitest";
import { fillWords } from "@shared/placeholders";
import { plural, savedText } from "./plural";

const bear = { unit: "jar", units: "jars" };
const panda = { unit: "shoot", units: "shoots" };
const icebear = { unit: "fish", units: "fish" };

describe("plural", () => {
  it("uses the singular only for exactly one", () => {
    const forms = { one: "one", other: "other" };
    expect([0, 1, 2, 41].map((n) => plural(n, forms))).toEqual(["other", "one", "other", "other"]);
  });

  it("writes the score as food saved, per theme", () => {
    expect(savedText(41, (t) => fillWords(t, bear))).toBe("41 jars saved");
    expect(savedText(1, (t) => fillWords(t, bear))).toBe("1 jar saved");
    expect(savedText(0, (t) => fillWords(t, bear))).toBe("0 jars saved");
    expect(savedText(1, (t) => fillWords(t, panda))).toBe("1 shoot saved");
    expect(savedText(12, (t) => fillWords(t, panda))).toBe("12 shoots saved");
    expect(savedText(1, (t) => fillWords(t, icebear))).toBe("1 fish saved");
    expect(savedText(7, (t) => fillWords(t, icebear))).toBe("7 fish saved");
  });
});
