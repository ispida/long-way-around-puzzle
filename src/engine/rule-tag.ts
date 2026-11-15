/**
 * Rule generations. When the rules of a behaviour change after launch, its
 * generation goes up here. A level's rule tag names the changed behaviours its tiles use, so exactly
 * those levels start fresh (records in the browser); every other level keeps its
 * tag "" and with it its history.
 */
import type { Registry } from "./content/registry";

/** Behaviours whose rules changed, by generation. 2026-10-08: the animal counts hive bonuses as cost. */
export const RULE_GENERATIONS: Readonly<Record<string, number>> = { bonus: 2 };

/** E.g. "bonus2" for a level with hives; "" if all its tiles still play by their original rules. */
export function ruleTag(registry: Registry, map: readonly string[]): string {
  const types = new Set<string>();
  for (const c of new Set(map.join(""))) {
    const tile = registry.tiles[registry.tileByChar.get(c) ?? -1];
    for (const b of tile?.behaviors ?? []) types.add(b.type);
  }
  return [...types]
    .filter((t) => (RULE_GENERATIONS[t] ?? 1) > 1)
    .sort()
    .map((t) => `${t}${RULE_GENERATIONS[t]}`)
    .join(",");
}
