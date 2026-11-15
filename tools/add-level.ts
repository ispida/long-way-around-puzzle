/**
 * `npm run add-level -- <level.json> [--campaign <position>] [--replace] [--content <dir>]`
 *
 * Puts a level file into the campaign as content/levels/campaign/lvlNN.json:
 * at the end, or at <position> (the following levels move up one number), or with --replace instead of
 * the level at <position>. Ids follow the file names; stored solutions are re-encoded for the new ids
 * (the encoding is keyed by the id). Everything is checked on a copy of content/ first (the same checks
 * as `npm run validate`); nothing is written if that copy has problems.
 */
import { cpSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renameLevel, type Registry } from "@engine/index";

export { renameLevel };
import { CampaignSchema, LevelSchema } from "@shared/schemas";
import type { CampaignJson, LevelJson } from "@shared/types";
import { checkContent } from "./content-check";
import { CONTENT_DIR, loadContent } from "./content-io";
import { formatJson } from "./solve";

export const MAX_CAMPAIGN = 20;

export const campaignId = (position: number): string => `lvl${String(position).padStart(2, "0")}`;

export interface AddPlan {
  campaign: CampaignJson;
  /** Files to write (file name -> level), in content/levels/campaign/. */
  files: Map<string, LevelJson>;
  /** The new level's position (1-based) and id. */
  position: number;
  id: string;
  /** Levels whose number changes (players' progress is stored per id). */
  moved: string[];
}

/** Works out the new campaign without touching files. */
export function planAdd(
  registry: Registry,
  campaign: CampaignJson,
  levels: ReadonlyMap<string, LevelJson>,
  level: LevelJson,
  opts: { position?: number; replace?: boolean } = {},
): AddPlan {
  const count = campaign.levels.length;
  const replace = opts.replace ?? false;
  const position = opts.position ?? (replace ? 0 : count + 1);
  if (replace) {
    if (!(position >= 1 && position <= count))
      throw new Error(`--replace needs a position from 1 to ${count}`);
  } else {
    if (!(position >= 1 && position <= count + 1)) throw new Error(`position must be from 1 to ${count + 1}`);
    if (count >= MAX_CAMPAIGN) throw new Error(`the campaign already has ${MAX_CAMPAIGN} levels`);
  }

  const order = campaign.levels.map((id) => {
    const l = levels.get(id);
    if (!l) throw new Error(`campaign.json lists ${id}, but there is no ${id}.json`);
    return l;
  });
  if (replace) order.splice(position - 1, 1, level);
  else order.splice(position - 1, 0, level);

  const files = new Map<string, LevelJson>();
  const moved: string[] = [];
  order.forEach((l, i) => {
    const id = campaignId(i + 1);
    const isNew = l === level;
    if (!isNew && l.id !== id) moved.push(`${l.id} → ${id}`);
    if (isNew || l.id !== id) files.set(`${id}.json`, renameLevel(registry, l, id));
  });
  return {
    campaign: { ...campaign, levels: order.map((_, i) => campaignId(i + 1)) },
    files,
    position,
    id: campaignId(position),
    moved,
  };
}

async function main(argv: string[]): Promise<number> {
  let file: string | undefined;
  let position: number | undefined;
  let replace = false;
  let root = CONTENT_DIR;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--campaign") position = Number(argv[++i]);
    else if (a === "--content") root = argv[++i] ?? root;
    else if (a === "--replace") replace = true;
    else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else file = a;
  }
  if (!file) {
    console.error("usage: npm run add-level -- <level.json> [--campaign <position>] [--replace]");
    return 1;
  }
  const { registry } = loadContent(root);
  const level = LevelSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const dir = join(root, "levels", "campaign");
  const campaign = CampaignSchema.parse(JSON.parse(readFileSync(join(dir, "campaign.json"), "utf8")));
  const levels = new Map(
    campaign.levels.map((id) => [
      id,
      LevelSchema.parse(JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"))),
    ]),
  );
  const plan = planAdd(registry, campaign, levels, level, { ...(position ? { position } : {}), replace });

  // Try it on a copy of content/ first.
  const tmp = mkdtempSync(join(tmpdir(), "lwr-add-level-"));
  try {
    cpSync(root, tmp, { recursive: true });
    const write = async (root: string) => {
      const d = join(root, "levels", "campaign");
      for (const [name, l] of plan.files) writeFileSync(join(d, name), await formatJson(l, join(d, name)));
      const manifest = join(d, "campaign.json");
      const text = await formatJson(plan.campaign, manifest);
      writeFileSync(`${manifest}.tmp`, text);
      renameSync(`${manifest}.tmp`, manifest);
    };
    await write(tmp);
    const { issues } = checkContent(tmp);
    if (issues.length > 0) {
      console.error(`✗ not added, the campaign would have problems:`);
      for (const i of issues) console.error(`  ${i.file}: ${i.message}`);
      return 1;
    }
    await write(root);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(
    `✓ added "${level.name}" as ${plan.id} (level ${plan.position} of ${plan.campaign.levels.length})`,
  );
  if (plan.moved.length > 0) {
    console.log(`  renumbered: ${plan.moved.join(", ")}`);
    console.log(
      "  note: players' saved progress is stored per level id, so it now belongs to the new numbers.",
    );
  }
  if (!level.solution)
    console.log(`  no solution yet: npm run solve -- content/levels/campaign/${plan.id}.json`);
  return 0;
}

if (process.argv[1]?.endsWith("add-level.ts")) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error((e as Error).message);
      process.exit(1);
    },
  );
}
