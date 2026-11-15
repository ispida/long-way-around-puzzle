import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { placeholderKeys } from "@shared/placeholders";
import { checkContent } from "./content-check";

const REAL = fileURLToPath(new URL("../content", import.meta.url));
const FIXTURES = fileURLToPath(new URL("../tests/fixtures/campaign", import.meta.url));
let tmp: string | undefined;

/** Copy of the real content folder that a test may break. */
function copy(): string {
  tmp = mkdtempSync(join(tmpdir(), "lwr-content-"));
  const dir = join(tmp, "content");
  cpSync(REAL, dir, { recursive: true });
  // The tests below edit lvl01/lvl02: use the fixed test levels, whatever the real campaign holds.
  rmSync(join(dir, "levels", "campaign"), { recursive: true });
  cpSync(FIXTURES, join(dir, "levels", "campaign"), { recursive: true });
  return dir;
}
const write = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value));

afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

describe("checkContent", () => {
  it("accepts the shipped content", () => {
    const { issues, summary } = checkContent(REAL);
    expect(issues).toEqual([]);
    expect(summary.tiles.map((t) => t.id)).toContain("hive");
    expect(summary.pieces.map((p) => p.id)).toEqual(["hedge"]);
  });

  it("reports a duplicate map character with file and owner", () => {
    const dir = copy();
    write(join(dir, "tiles", "rock.json"), {
      id: "rock",
      chars: ["T"],
      walkable: false,
      editor: { group: "obstacle", order: 30 },
    });
    const { issues } = checkContent(dir);
    // Files are read alphabetically, so "rock" claims "T" first and "tree" is reported.
    expect(issues).toEqual([
      { file: "content/tiles/tree.json", message: 'map character "T" is already used by tile "rock"' },
    ]);
  });

  it("reports schema errors with the field path", () => {
    const dir = copy();
    write(join(dir, "tiles", "mud.json"), {
      id: "mud",
      chars: ["m"],
      walkable: true,
      cost: 0,
      editor: { group: "terrain", order: 20 },
    });
    // Levels using mud also fail as a consequence; only the tile file is checked here.
    const issues = checkContent(dir).issues.filter((i) => i.file === "content/tiles/mud.json");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/^cost: /);
  });

  it("checks id against file name, unknown pieces and invalid JSON", () => {
    const dir = copy();
    write(join(dir, "tiles", "deep-mud.json"), {
      id: "deepmud",
      chars: ["d"],
      walkable: true,
      cost: 5,
      accepts: ["puddle"],
      editor: { group: "terrain", order: 25 },
    });
    writeFileSync(join(dir, "pieces", "broken.json"), "{ nope");
    const messages = checkContent(dir).issues.map((i) => i.message);
    expect(messages).toContain('id "deepmud" must match the file name "deep-mud"');
    expect(messages).toContain('accepts unknown piece "puddle"');
    expect(messages.some((m) => m.startsWith("invalid JSON"))).toBe(true);
  });

  it("checks levels against tiles, pieces and the campaign manifest", () => {
    const dir = copy();
    const level = {
      schema: 1,
      id: "lvl01",
      name: "First",
      tag: "Basics",
      text: "",
      map: ["B.X.H"],
      pieces: { hedge: 3, puddle: 1 },
    };
    write(join(dir, "levels", "campaign", "lvl01.json"), level);
    write(join(dir, "levels", "campaign", "campaign.json"), {
      levels: ["lvl01", "lvl09"],
      unlock: "sequential",
    });
    write(join(dir, "levels", "daily", "03-10-2026.json"), level);
    const messages = checkContent(dir).issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'unknown map character "X" (row 1, column 3)',
        'unknown piece "puddle"',
        'lists unknown level "lvl09"',
        "daily files are named by date: YYYY-MM-DD.json",
      ]),
    );
  });

  it("checks placeholders, bonus values and level ids", () => {
    const dir = copy();
    const lvl = JSON.parse(readFileSync(join(dir, "levels", "campaign", "lvl02.json"), "utf8")) as Record<
      string,
      unknown
    >;
    write(join(dir, "levels", "campaign", "lvl02.json"), {
      ...lvl,
      id: "serpentine",
      text: "The {unicorn} runs.",
    });
    const hive = JSON.parse(readFileSync(join(dir, "tiles", "hive.json"), "utf8")) as Record<string, unknown>;
    write(join(dir, "tiles", "hive.json"), {
      ...hive,
      behaviors: [{ type: "bonus", points: -1 }],
    });
    const messages = checkContent(dir).issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        'id "serpentine" must match the file name "lvl02"',
        'text: "{unicorn}" is not a word of the default theme',
        "cost 1 plus a bonus of -1 must be at least 1",
      ]),
    );
  });

  it("runs the engine's level checks", () => {
    const dir = copy();
    const lvl = JSON.parse(readFileSync(join(dir, "levels", "campaign", "lvl01.json"), "utf8")) as Record<
      string,
      unknown
    >;
    write(join(dir, "levels", "campaign", "lvl01.json"), {
      ...lvl,
      startScore: 99,
      map: ["B.1..TH", "...T..."],
    });
    const messages = checkContent(dir).issues.map((i) => i.message);
    expect(messages).toEqual(['portal "1" needs exactly 2 cells, found 1 (row 1, column 3)']);
    write(join(dir, "levels", "campaign", "lvl01.json"), { ...lvl, startScore: 99 });
    expect(checkContent(dir).issues.map((i) => i.message)).toEqual([
      "startScore is 99, but the level starts at 12",
    ]);
  });

  it("reports a solver solution whose inputs changed", () => {
    const dir = copy();
    const file = join(dir, "levels", "campaign", "lvl01.json");
    const lvl = JSON.parse(readFileSync(file, "utf8")) as { solution: Record<string, unknown> };
    expect(lvl.solution).toMatchObject({ method: "cp-sat" });
    expect(checkContent(dir).issues).toEqual([]);
    // Same map and solution, one more hedge: the stored optimum may no longer be the best.
    write(file, { ...lvl, pieces: { hedge: 4 } });
    expect(checkContent(dir).issues.map((i) => i.message)).toEqual([
      "solution is out of date (the level or its tiles changed): run npm run solve",
    ]);
  });

  it("checks theme pictures and rulebook examples", () => {
    const dir = copy();
    rmSync(join(dir, "themes", "default", "tiles", "hive.svg"));
    writeFileSync(join(dir, "themes", "panda", "tiles", "lava.svg"), "<svg/>");
    writeFileSync(join(dir, "themes", "panda", "tiles", "Mud.PNG"), "x");
    const mud = JSON.parse(readFileSync(join(dir, "tiles", "mud.json"), "utf8")) as {
      card: Record<string, unknown>;
    };
    write(join(dir, "tiles", "mud.json"), {
      ...mud,
      card: { ...mud.card, example: { map: ["B.mT.H"], hedges: [[2, 0]] } },
    });
    const messages = checkContent(dir).issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "missing picture tiles/hive.svg (or .png/.webp)",
        '"lava" is not a known tile',
        "picture names look like grass.svg or grass.2.svg (svg, png or webp)",
        "card.example: no hedge allowed at row 1, column 3",
        "card.example: rulebook boards are 4 rows of 7 tiles",
      ]),
    );
  });

  it("takes walk frames, but only next to the theme's own animal", () => {
    const dir = copy();
    writeFileSync(join(dir, "themes", "default", "actors", "animal-walk.2.svg"), "<svg/>");
    expect(checkContent(dir).issues).toEqual([]);
    mkdirSync(join(dir, "themes", "bear", "actors"), { recursive: true });
    writeFileSync(join(dir, "themes", "bear", "actors", "animal-walk.svg"), "<svg/>");
    expect(checkContent(dir).issues.map((i) => i.message)).toEqual([
      "the walk (animal-walk) needs this theme's own animal picture, so the animal sits and walks alike",
    ]);
  });

  it("checks theme inheritance", () => {
    const dir = copy();
    write(join(dir, "themes", "bear", "theme.json"), { id: "bear", name: "Bear", extends: "grizzly" });
    const messages = checkContent(dir).issues.map((i) => i.message);
    expect(messages).toContain('extends unknown theme "grizzly"');
  });
});

describe("theme words", () => {
  const { summary } = checkContent(REAL);
  const byId = new Map(summary.themes.map((t) => [t.id, t]));
  /** Words of a theme merged along its extends chain, the theme's own words winning. */
  const words = (id: string): Record<string, string> => {
    const chain: string[] = [];
    for (let t: string | undefined = id; t && !chain.includes(t); t = byId.get(t)?.extends) chain.push(t);
    if (!chain.includes("default")) chain.push("default");
    return Object.assign({}, ...chain.reverse().map((t) => byId.get(t)?.words ?? {})) as Record<
      string,
      string
    >;
  };
  const used = new Set<string>();
  for (const t of summary.tiles)
    for (const s of [t.card?.title, t.card?.text]) if (s) placeholderKeys(s).forEach((k) => used.add(k));
  for (const l of summary.levels) placeholderKeys(l.text).forEach((k) => used.add(k));
  const CAST = [
    "animal",
    "Animal",
    "food",
    "Food",
    "pot",
    "unit",
    "units",
    "guardians",
    "Guardians",
    "piece",
    "pieces",
    "Piece",
    "bonus",
  ];

  it.each(summary.themes.map((t) => t.id))(
    "theme %s resolves every word used in content and the full cast",
    (id) => {
      const w = words(id);
      expect([...used, ...CAST].filter((k) => !(k in w))).toEqual([]);
    },
  );

  it("loads the ice bear and panda themes with their own casts", () => {
    expect(byId.get("icebear")?.extends).toBe("default");
    expect(words("icebear")).toMatchObject({
      animal: "ice bear",
      food: "fish",
      guardians: "puffins",
      piece: "ice wall",
      bonus: "walruses",
      slope: "Ice slides",
    });
    expect(words("panda")).toMatchObject({
      guardians: "red pandas",
      units: "shoots",
      piece: "lantern",
      bonus: "monkeys",
    });
    expect(words("bear")).toMatchObject({ guardians: "bees", units: "jars", piece: "log" });
  });
});
