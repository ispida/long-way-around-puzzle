import { describe, expect, it } from "vitest";
import { buildLibrary, findPicture, findWalkFrames, mergedWords, themeChain, variantIndex } from "./library";
import { selectableThemes, themeLibrary } from "./manifest";

const lib = buildLibrary(
  {
    "/content/themes/default/theme.json": {
      id: "default",
      name: "Default",
      words: { animal: "bear", food: "honey" },
    },
    "/content/themes/panda/theme.json": {
      id: "panda",
      name: "Panda",
      extends: "default",
      words: { animal: "panda" },
    },
    "/content/themes/icebear/theme.json": {
      id: "icebear",
      name: "Ice bear",
      extends: "panda",
      words: { food: "fish" },
    },
  },
  {
    "/content/themes/default/tiles/grass.svg": "g1",
    "/content/themes/default/tiles/grass.3.svg": "g3",
    "/content/themes/default/tiles/grass.2.svg": "g2",
    "/content/themes/default/tiles/mud.svg": "mud",
    "/content/themes/default/actors/animal.svg": "bear",
    "/content/themes/panda/tiles/mud.svg": "snow",
    "/content/themes/panda/actors/animal.svg": "panda",
    "/content/themes/panda/actors/animal-walk.2.svg": "panda-walk2",
    "/content/themes/panda/actors/animal-walk.svg": "panda-walk1",
    "/content/themes/icebear/actors/animal.svg": "icebear",
    "/content/themes/default/readme.txt": "ignored",
  },
);

describe("theme library", () => {
  it("orders variants and ignores unknown files", () => {
    expect(lib.get("default")?.pictures.get("tiles/grass")).toEqual(["g1", "g2", "g3"]);
    expect(lib.get("default")?.pictures.size).toBe(3);
  });
  it("follows the extends chain down to default", () => {
    expect(themeChain(lib, "icebear")).toEqual(["icebear", "panda", "default"]);
    expect(themeChain(lib, "nope")).toEqual(["default"]);
  });
  it("finds pictures in the nearest theme that has them", () => {
    const chain = themeChain(lib, "icebear");
    expect(findPicture(lib, chain, "actors", "animal")).toEqual(["icebear"]);
    expect(findPicture(lib, chain, "tiles", "mud")).toEqual(["snow"]);
    expect(findPicture(lib, chain, "tiles", "grass")).toEqual(["g1", "g2", "g3"]);
    expect(findPicture(lib, chain, "tiles", "lava")).toBeUndefined();
  });
  it("takes walk frames only from the theme whose animal sits there", () => {
    expect(findWalkFrames(lib, themeChain(lib, "panda"))).toEqual(["panda-walk1", "panda-walk2"]);
    // The ice bear has its own animal: it never walks as a panda.
    expect(findWalkFrames(lib, themeChain(lib, "icebear"))).toEqual([]);
    expect(findWalkFrames(lib, themeChain(lib, "default"))).toEqual([]);
  });
  it("merges words, the theme's own winning", () => {
    expect(mergedWords(lib, themeChain(lib, "icebear"))).toEqual({ animal: "panda", food: "fish" });
  });
  it("picks stable, varied variants", () => {
    expect(variantIndex(3, 4, 3)).toBe(variantIndex(3, 4, 3));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => variantIndex(i % 6, Math.floor(i / 6), 3)));
    expect(seen.size).toBe(3);
    expect(variantIndex(5, 5, 1)).toBe(0);
  });
  it("loads the shipped themes", () => {
    expect(selectableThemes()).toEqual([
      { id: "bear", name: "Brown bear" },
      { id: "panda", name: "Panda" },
      { id: "icebear", name: "Ice bear" },
    ]);
    const real = themeLibrary();
    const pic = (theme: string, kind: "tiles" | "actors" | "pieces", name: string) =>
      findPicture(real, themeChain(real, theme), kind, name)?.[0];
    // Small pictures are inlined by Vite, so compare which file was chosen, not its URL.
    expect(pic("bear", "actors", "animal")).toBe(real.get("default")?.pictures.get("actors/animal")?.[0]);
    expect(pic("panda", "actors", "animal")).toBe(real.get("panda")?.pictures.get("actors/animal")?.[0]);
    expect(pic("panda", "actors", "animal")).not.toBe(pic("bear", "actors", "animal"));
    // Every selectable theme draws every tile, piece and actor with its own picture (bear = default).
    const all = [
      ...["grass", "tree", "water", "mud", "slope", "burrow", "hive"].map((n) => ["tiles", n] as const),
      ["pieces", "hedge"] as const,
      ["actors", "animal"] as const,
      ["actors", "food"] as const,
    ];
    for (const [kind, name] of all)
      for (const theme of ["panda", "icebear"]) {
        const own = findPicture(real, themeChain(real, theme), kind, name)?.[0];
        expect(own, `${theme} ${kind}/${name}`).toBe(real.get(theme)?.pictures.get(`${kind}/${name}`)?.[0]);
        expect(own, `${theme} ${kind}/${name}`).not.toBe(pic("bear", kind, name));
      }
  });
});
