/** Node-side content loading for tools and tests (the engine itself never reads files). */
import { fileURLToPath } from "node:url";
import { buildRegistry, type Registry } from "@engine/index";
import type { LevelJson, ThemeDef } from "@shared/types";
import { checkContent } from "./content-check";

export const CONTENT_DIR = fileURLToPath(new URL("../content", import.meta.url));
/** The levels the tests use, independent of the real campaign. */
export const FIXTURE_CAMPAIGN = fileURLToPath(new URL("../tests/fixtures/campaign", import.meta.url));

export interface LoadedContent {
  registry: Registry;
  levels: LevelJson[];
  themes: ThemeDef[];
  /** The test levels in tests/fixtures/campaign (lvl01–lvl08, the prototype levels). */
  fixtures: LevelJson[];
}

/**
 * Loads and validates content; throws with all problems listed if anything is invalid. With
 * `ignoreSolutions`, stored solutions aren't checked (the solver tools re-solve stale ones).
 */
export function loadContent(
  root: string = CONTENT_DIR,
  opts: { ignoreSolutions?: boolean } = {},
): LoadedContent {
  const { issues, summary } = checkContent(root, { campaigns: [FIXTURE_CAMPAIGN], ...opts });
  if (issues.length > 0) {
    throw new Error(`content/ has problems:\n${issues.map((i) => `  ${i.file}: ${i.message}`).join("\n")}`);
  }
  return {
    registry: buildRegistry(summary),
    levels: summary.levels,
    themes: summary.themes,
    fixtures: summary.extraLevels,
  };
}
