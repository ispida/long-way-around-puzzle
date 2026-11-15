/** Every {placeholder} in the UI strings must be a word of the default theme. */
import { describe, expect, it } from "vitest";
import { placeholderKeys } from "@shared/placeholders";
import { loadContent } from "../../tools/content-io";
import { text } from "../../src/ui/text";

function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return []; // functions build their text from numbers only
}

describe("UI text placeholders", () => {
  it("only use words the default theme defines", () => {
    const words = loadContent().themes.find((t) => t.id === "default")?.words ?? {};
    const missing = strings(text)
      .flatMap(placeholderKeys)
      .filter((k) => k !== "n" && !(k in words));
    expect([...new Set(missing)]).toEqual([]);
  });
});
