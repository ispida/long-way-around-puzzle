/**
 * Validates everything in content/. Used by `npm run validate` and CI.
 * Returns a list of readable issues instead of throwing, so all problems show at once.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { z } from "zod";
import {
  buildRegistry,
  canPlace,
  ContentError,
  LevelError,
  parseLevel,
  validateLevel,
  type Registry,
} from "@engine/index";
import { isIsoDate } from "@shared/dates";
import { placeholderKeys } from "@shared/placeholders";
import {
  CampaignSchema,
  LevelSchema,
  PieceSchema,
  RulesetSchema,
  ThemeSchema,
  TileSchema,
} from "@shared/schemas";
import { solveInputs } from "./solution";
import type { LevelJson, PieceDef, RulesetDef, ThemeDef, TileDef } from "@shared/types";

export interface Issue {
  file: string;
  message: string;
}

export interface ContentSummary {
  tiles: TileDef[];
  pieces: PieceDef[];
  rulesets: RulesetDef[];
  themes: ThemeDef[];
  levels: LevelJson[];
  /** Levels from `opts.campaigns`, kept apart from the content's own. */
  extraLevels: LevelJson[];
}

export interface CheckOptions {
  /** More campaign-shaped folders to check with the same rules, e.g. tests/fixtures/campaign. */
  campaigns?: string[];
  /**
   * Leave out the checks of stored solutions (their score and whether they are out of date): for
   * `npm run solve` and the solver bridge, which must load levels whose solutions a rule change made
   * stale.
   */
  ignoreSolutions?: boolean;
}

export function checkContent(
  root: string,
  opts: CheckOptions = {},
): { issues: Issue[]; summary: ContentSummary } {
  const issues: Issue[] = [];
  const rel = (f: string) => relative(join(root, ".."), f);
  const report = (file: string, message: string) => issues.push({ file: rel(file), message });

  /** Reads all *.json in a folder and validates them; the id must equal the file name. */
  function loadDir<S extends z.ZodType>(dir: string, schema: S, idFromName = true): z.output<S>[] {
    if (!existsSync(dir)) return [];
    const out: z.output<S>[] = [];
    for (const name of readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .sort()) {
      const file = join(dir, name);
      const value = parseFile(file, schema, report);
      if (value === undefined) continue;
      const id = (value as { id?: string }).id;
      if (idFromName && id !== basename(name, ".json")) {
        report(file, `id "${String(id)}" must match the file name "${basename(name, ".json")}"`);
      }
      out.push(value);
    }
    return out;
  }

  const tiles = loadDir(join(root, "tiles"), TileSchema);
  const pieces = loadDir(join(root, "pieces"), PieceSchema);
  const rulesets = loadDir(join(root, "rulesets"), RulesetSchema);

  // Tiles: unique map characters, known pieces, exactly one start and at least one goal.
  const charOwner = new Map<string, string>();
  const pieceIds = new Set(pieces.map((p) => p.id));
  for (const t of tiles) {
    const file = join(root, "tiles", `${t.id}.json`);
    for (const c of t.chars) {
      const owner = charOwner.get(c);
      if (owner) report(file, `map character "${c}" is already used by tile "${owner}"`);
      else charOwner.set(c, t.id);
    }
    for (const p of t.accepts) if (!pieceIds.has(p)) report(file, `accepts unknown piece "${p}"`);
    if (!t.walkable && t.behaviors.length > 0)
      report(file, "a tile that is not walkable can't have behaviours");
    for (const b of t.behaviors) {
      // The animal minimises steps + bonus: every move must still count.
      if (b.type === "bonus" && t.cost + b.points < 1) {
        report(file, `cost ${t.cost} plus a bonus of ${b.points} must be at least 1`);
      }
    }
  }
  if (tiles.length > 0) {
    const starts = tiles.filter((t) => t.role === "start").length;
    if (starts !== 1) report(join(root, "tiles"), `exactly one tile needs role "start" (found ${starts})`);
    if (!tiles.some((t) => t.role === "goal"))
      report(join(root, "tiles"), `at least one tile needs role "goal"`);
  }
  if (rulesets.length > 0 && !rulesets.some((r) => r.id === "default")) {
    report(join(root, "rulesets"), `a "default" rule set is required`);
  }

  // The engine registry needs consistent tiles, pieces and rule sets; levels are checked with it.
  let registry: Registry | undefined;
  if (issues.length === 0 && tiles.length > 0) {
    try {
      registry = buildRegistry({ tiles, pieces, rulesets });
    } catch (e) {
      if (!(e instanceof ContentError)) throw e;
      report(join(root, "tiles"), e.message);
    }
  }

  const themes = checkThemes(join(root, "themes"));
  const words = themes.find((t) => t.id === "default")?.words;
  const checkWords = (file: string, field: string, text: string) => {
    if (!words) return;
    for (const k of placeholderKeys(text)) {
      if (!(k in words)) report(file, `${field}: "{${k}}" is not a word of the default theme`);
    }
  };
  for (const t of tiles) {
    if (t.card) {
      const file = join(root, "tiles", `${t.id}.json`);
      checkWords(file, "card.title", t.card.title);
      checkWords(file, "card.text", t.card.text);
      if (t.card.example && registry) checkExample(file, registry, t.card.example);
    }
  }
  if (registry) checkPictures(join(root, "themes"), themes);
  const extraLevels: LevelJson[] = [];
  const levels = checkLevels(join(root, "levels"));

  return { issues, summary: { tiles, pieces, rulesets, themes, levels, extraLevels } };

  /** Rulebook example boards are 4 × 7 tiles (one picture size on /rules), parse, and their hedges sit on allowed cells. */
  function checkExample(file: string, reg: Registry, ex: { map: string[]; hedges: [number, number][] }) {
    if (ex.map.length !== 4 || ex.map.some((row) => row.length !== 7))
      report(file, "card.example: rulebook boards are 4 rows of 7 tiles");
    try {
      const level = LevelSchema.parse({
        schema: 1,
        id: "example",
        name: "x",
        tag: "x",
        text: "",
        map: ex.map,
        pieces: { hedge: Math.max(1, ex.hedges.length) },
      });
      const board = parseLevel(reg, level);
      for (const [x, y] of ex.hedges) {
        if (!canPlace(board, y * board.w + x, "hedge"))
          report(file, `card.example: no hedge allowed at row ${y + 1}, column ${x + 1}`);
      }
    } catch (e) {
      if (e instanceof LevelError || e instanceof Error) report(file, `card.example: ${e.message}`);
    }
  }

  /**
   * Pictures: the default theme needs one for every tile, piece and actor;
   * every picture in any theme must belong to a known tile, piece or actor. The walk (animal-walk.svg,
   * animal-walk.2.svg, … as frames) belongs to the theme's own sitting animal.
   */
  function checkPictures(dir: string, found: ThemeDef[]) {
    const tileNames = new Set(tiles.map((t) => t.image?.base ?? t.id));
    const known: Record<string, Set<string>> = {
      tiles: new Set([...tileNames, "grass"]),
      pieces: new Set(pieces.map((p) => p.id)),
      actors: new Set(["animal", "animal-walk", "food"]),
    };
    const has = new Map<string, Set<string>>();
    for (const t of found) {
      const names = new Set<string>();
      for (const kind of readdirSync(join(dir, t.id))) {
        const kindDir = join(dir, t.id, kind);
        if (!statSync(kindDir).isDirectory()) continue;
        const allowed = known[kind];
        if (!allowed) {
          report(kindDir, `unknown picture folder "${kind}" (use tiles, pieces or actors)`);
          continue;
        }
        for (const name of readdirSync(kindDir)) {
          const m = /^([a-z0-9-]+)(?:\.(\d+))?\.(svg|png|webp)$/.exec(name);
          if (!m) {
            report(
              join(kindDir, name),
              "picture names look like grass.svg or grass.2.svg (svg, png or webp)",
            );
          } else if (!allowed.has(m[1] ?? "")) {
            report(join(kindDir, name), `"${m[1]}" is not a known ${kind.slice(0, -1)}`);
          } else {
            names.add(`${kind}/${m[1]}`);
          }
        }
      }
      has.set(t.id, names);
      if (names.has("actors/animal-walk") && !names.has("actors/animal"))
        report(
          join(dir, t.id, "actors"),
          "the walk (animal-walk) needs this theme's own animal picture, so the animal sits and walks alike",
        );
    }
    const def = has.get("default");
    if (!def) {
      if (found.length > 0) report(dir, 'a "default" theme with every picture is required');
      return;
    }
    for (const [kind, names] of Object.entries(known)) {
      for (const n of names) {
        if (!def.has(`${kind}/${n}`))
          report(join(dir, "default", kind), `missing picture ${kind}/${n}.svg (or .png/.webp)`);
      }
    }
  }

  function checkThemes(dir: string): ThemeDef[] {
    if (!existsSync(dir)) return [];
    const found: ThemeDef[] = [];
    for (const name of readdirSync(dir).sort()) {
      const folder = join(dir, name);
      if (!statSync(folder).isDirectory()) continue;
      const file = join(folder, "theme.json");
      if (!existsSync(file)) {
        report(folder, "theme folder without theme.json");
        continue;
      }
      const theme = parseFile(file, ThemeSchema, report);
      if (!theme) continue;
      if (theme.id !== name) report(file, `id "${theme.id}" must match the folder name "${name}"`);
      found.push(theme);
    }
    const byId = new Map(found.map((t) => [t.id, t]));
    for (const t of found) {
      const seen = new Set([t.id]);
      for (let p = t.extends; p; p = byId.get(p)?.extends) {
        const file = join(dir, t.id, "theme.json");
        if (!byId.has(p)) {
          report(file, `extends unknown theme "${p}"`);
          break;
        }
        if (seen.has(p)) {
          report(file, `"extends" forms a loop through "${p}"`);
          break;
        }
        seen.add(p);
      }
    }
    return found;
  }

  function checkLevels(dir: string): LevelJson[] {
    const all: LevelJson[] = [];
    const rulesetIds = new Set(rulesets.map((r) => r.id));

    const checkLevel = (file: string, level: LevelJson, into: LevelJson[] = all) => {
      into.push(level);
      checkWords(file, "text", level.text);
      if (registry) {
        const checked = opts.ignoreSolutions ? { ...level, solution: undefined } : level;
        const levelIssues = validateLevel(registry, checked);
        for (const i of levelIssues) {
          report(file, i.cell ? `${i.message} (row ${i.cell.y + 1}, column ${i.cell.x + 1})` : i.message);
        }
        // A broken level is reported above; staleness only matters once it is valid again.
        const sol = level.solution;
        if (
          levelIssues.length === 0 &&
          !opts.ignoreSolutions &&
          sol?.method === "cp-sat" &&
          sol.inputs !== solveInputs(registry, level)
        )
          report(file, "solution is out of date (the level or its tiles changed): run npm run solve");
        return;
      }
      // Without a registry (broken tiles), only basic checks are possible.
      const chars = new Set(level.map.join(""));
      for (const c of chars) if (!charOwner.has(c)) report(file, `map uses unknown character "${c}"`);
      for (const p of Object.keys(level.pieces)) if (!pieceIds.has(p)) report(file, `unknown piece "${p}"`);
      if (!rulesetIds.has(level.rules)) report(file, `unknown rule set "${level.rules}"`);
    };

    /** A campaign folder: lvlNN.json files listed by campaign.json. */
    function checkCampaignDir(campaignDir: string, into: LevelJson[]) {
      if (existsSync(campaignDir)) {
        const ids = new Set<string>();
        for (const name of readdirSync(campaignDir)
          .filter((n) => /^lvl\d{2}\.json$/.test(n))
          .sort()) {
          const file = join(campaignDir, name);
          const level = parseFile(file, LevelSchema, report);
          if (!level) continue;
          if (level.id !== basename(name, ".json")) {
            report(file, `id "${level.id}" must match the file name "${basename(name, ".json")}"`);
          }
          ids.add(level.id);
          checkLevel(file, level, into);
        }
        const manifest = join(campaignDir, "campaign.json");
        if (existsSync(manifest)) {
          const campaign = parseFile(manifest, CampaignSchema, report);
          for (const id of campaign?.levels ?? [])
            if (!ids.has(id)) report(manifest, `lists unknown level "${id}"`);
        } else if (ids.size > 0) {
          report(campaignDir, "campaign.json is missing");
        }
        for (const name of readdirSync(campaignDir).filter((n) => n.endsWith(".json"))) {
          if (name !== "campaign.json" && !/^lvl\d{2}\.json$/.test(name)) {
            report(join(campaignDir, name), "campaign level files are named lvl01.json … lvl20.json");
          }
        }
      }
    }

    checkCampaignDir(join(dir, "campaign"), all);
    for (const extra of opts.campaigns ?? []) checkCampaignDir(extra, extraLevels);

    const dailyDir = join(dir, "daily");
    if (existsSync(dailyDir)) {
      for (const name of readdirSync(dailyDir)
        .filter((n) => n.endsWith(".json"))
        .sort()) {
        const file = join(dailyDir, name);
        if (!isIsoDate(basename(name, ".json"))) {
          report(file, "daily files are named by date: YYYY-MM-DD.json");
          continue;
        }
        const level = parseFile(file, LevelSchema, report);
        if (level?.id !== basename(name, ".json")) {
          if (level) report(file, `id "${level.id}" must match the file name "${basename(name, ".json")}"`);
        }
        // Dailies are checked like campaign levels but kept out of `levels` (the campaign).
        if (level) checkLevel(file, level, []);
      }
    }
    return all;
  }
}

function parseFile<S extends z.ZodType>(
  file: string,
  schema: S,
  report: (file: string, message: string) => void,
): z.output<S> | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    report(file, `invalid JSON: ${(e as Error).message}`);
    return undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const where = issue.path.length ? issue.path.join(".") : "(file)";
      report(file, `${where}: ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}
