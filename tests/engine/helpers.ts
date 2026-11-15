/**
 * Test helpers: the shipped tiles, pieces and themes as a registry, the test levels, and quick level
 * construction from a map. `content().levels` are the fixed test levels in tests/fixtures/campaign
 * (the 8 prototype levels, lvl01–lvl08), not the real campaign, which may change.
 */
import { parseLevel, type Board, type Placements, type Registry } from "@engine/index";
import { LevelSchema } from "@shared/schemas";
import type { LevelJson } from "@shared/types";
import { loadContent } from "../../tools/content-io";

let cached: ReturnType<typeof loadContent> | undefined;
const loaded = () => (cached ??= loadContent());
export const content = () => ({ ...loaded(), levels: loaded().fixtures });
export const registry = (): Registry => content().registry;

export function makeLevel(map: string[], pieces: Record<string, number> = { hedge: 10 }): LevelJson {
  return LevelSchema.parse({ schema: 1, id: "test", name: "Test", tag: "Test", text: "", map, pieces });
}

export const board = (map: string[], pieces?: Record<string, number>): Board =>
  parseLevel(registry(), makeLevel(map, pieces));

/** Hedges at [x, y] positions. */
export function hedges(b: Board, coords: [number, number][]): Placements {
  return new Map(coords.map(([x, y]) => [y * b.w + x, "hedge"]));
}
