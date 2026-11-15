/**
 * Game content in the browser. Tiles, pieces, rule sets and the campaign manifest are bundled at build
 * time; each campaign level and each daily is its own small chunk, loaded on demand. The campaign and
 * the dailies come through the @campaign and @dailies aliases (vite.shared.ts): the real ones, or the
 * e2e fixtures. CI validates the files (npm run validate); here they are parsed again so a bad build
 * fails loudly.
 */
import { buildRegistry, ruleTag, type Registry } from "@engine/index";
import { isPublished } from "@shared/dates";
import { CampaignSchema, LevelSchema, PieceSchema, RulesetSchema, TileSchema } from "@shared/schemas";
import type { CampaignJson, LevelJson } from "@shared/types";

const tileFiles = import.meta.glob<unknown>("../../content/tiles/*.json", { eager: true, import: "default" });
const pieceFiles = import.meta.glob<unknown>("../../content/pieces/*.json", {
  eager: true,
  import: "default",
});
const rulesetFiles = import.meta.glob<unknown>("../../content/rulesets/*.json", {
  eager: true,
  import: "default",
});
const campaignFile = import.meta.glob<unknown>("@campaign/campaign.json", {
  eager: true,
  import: "default",
});
const levelFiles = import.meta.glob<unknown>("@campaign/lvl*.json", {
  import: "default",
});
const dailyFiles = import.meta.glob<unknown>("@dailies/*.json", { import: "default" });
// Only the maps are bundled up front: they decide each level's rule tag.
const levelMaps = import.meta.glob<string[]>("@campaign/lvl*.json", { eager: true, import: "map" });

const byName = <T>(files: Record<string, unknown>, parse: (v: unknown) => T): T[] =>
  Object.keys(files)
    .sort()
    .map((k) => parse(files[k]));

export interface GameContent {
  registry: Registry;
  campaign: CampaignJson;
  loadCampaignLevel(id: string): Promise<LevelJson | undefined>;
  /** Dates of the bundled dailies (content/levels/daily/YYYY-MM-DD.json) up to today (UTC), oldest first. */
  dailyDates: readonly string[];
  loadDaily(date: string): Promise<LevelJson | undefined>;
  /** Each campaign level's rule tag (ruleTag in @engine), by id. */
  ruleTags: ReadonlyMap<string, string>;
}

export function loadGameContent(): GameContent {
  const registry = buildRegistry({
    tiles: byName(tileFiles, (v) => TileSchema.parse(v)),
    pieces: byName(pieceFiles, (v) => PieceSchema.parse(v)),
    rulesets: byName(rulesetFiles, (v) => RulesetSchema.parse(v)),
  });
  const campaign = CampaignSchema.parse(
    Object.values(campaignFile)[0] ?? { levels: ["lvl01"], unlock: "all" },
  );
  const ruleTags = new Map(Object.entries(levelMaps).map(([k, map]) => [fileId(k), ruleTag(registry, map)]));
  return {
    registry,
    campaign,
    ruleTags,
    loadCampaignLevel: (id) => loadFrom(levelFiles, id),
    // A daily added ahead of time stays hidden until its date.
    dailyDates: Object.keys(dailyFiles)
      .map(fileId)
      .filter((d) => isPublished(d))
      .sort(),
    loadDaily: (date) => (isPublished(date) ? loadFrom(dailyFiles, date) : Promise.resolve(undefined)),
  };
}

// Keys are the files' paths (their form depends on the alias); match the file name.
const fileId = (path: string) => path.replace(/^.*\/|\.json$/g, "");

async function loadFrom(
  files: Record<string, () => Promise<unknown>>,
  id: string,
): Promise<LevelJson | undefined> {
  const key = Object.keys(files).find((k) => fileId(k) === id);
  const load = key ? files[key] : undefined;
  return load ? LevelSchema.parse(await load()) : undefined;
}
