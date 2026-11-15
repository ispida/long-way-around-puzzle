/** parseLevel: level JSON + registry -> Board. */
import type { LevelJson } from "@shared/types";
import { BEHAVIORS } from "./behaviors";
import type { BoardBuilder } from "./behaviors/types";
import type { Registry } from "./content/registry";
import type { Board } from "./types";

export class LevelError extends Error {
  override name = "LevelError";
  constructor(
    message: string,
    readonly cell?: number,
  ) {
    super(message);
  }
}

/** Builds the board. Throws LevelError on structural problems; validateLevel reports them gently. */
export function parseLevel(registry: Registry, level: LevelJson): Board {
  const h = level.map.length;
  const w = level.map[0]?.length ?? 0;
  const n = w * h;
  if (n === 0) throw new LevelError("the map is empty");

  const ruleset = registry.rulesets.get(level.rules);
  if (!ruleset) throw new LevelError(`unknown rule set "${level.rules}"`);

  const tileOf = new Uint16Array(n);
  const charOf: string[] = [];
  const walkable = new Uint8Array(n);
  const cost = new Uint8Array(n);
  const isGoal = new Uint8Array(n);
  const goals: number[] = [];
  let start = -1;

  for (let y = 0; y < h; y++) {
    const row = level.map[y] ?? "";
    if (row.length !== w) throw new LevelError(`row ${y + 1} has ${row.length} cells, expected ${w}`, y * w);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const c = row[x] ?? "";
      const t = registry.tileByChar.get(c);
      if (t === undefined) throw new LevelError(`unknown map character "${c}"`, i);
      const tile = registry.tiles[t];
      if (!tile) throw new LevelError(`unknown tile index ${t}`, i);
      tileOf[i] = t;
      charOf.push(c);
      walkable[i] = tile.walkable ? 1 : 0;
      cost[i] = tile.cost;
      if (tile.role === "start") {
        if (start !== -1) throw new LevelError("more than one start", i);
        start = i;
      } else if (tile.role === "goal") {
        isGoal[i] = 1;
        goals.push(i);
      }
    }
  }
  if (start === -1) throw new LevelError("no start");
  if (goals.length === 0) throw new LevelError("no goal");

  const b: BoardBuilder = {
    w,
    h,
    charOf,
    oneWay: new Uint8Array(n),
    partner: new Int32Array(n).fill(-1),
    tunnelCost: new Uint8Array(n),
    bonus: new Int16Array(n),
    errors: [],
  };
  const used = new Set<keyof typeof BEHAVIORS>();
  for (let i = 0; i < n; i++) {
    const tile = registry.tiles[tileOf[i] ?? 0];
    for (const def of tile?.behaviors ?? []) {
      used.add(def.type);
      // Each module only receives its own behaviour type.
      (BEHAVIORS[def.type].apply as (b: BoardBuilder, cell: number, d: typeof def) => void)(b, i, def);
    }
  }
  for (const type of used) BEHAVIORS[type].finish?.(b);
  const firstError = b.errors[0];
  if (firstError) throw new LevelError(firstError.message, firstError.cell);

  const pieceIds = Object.keys(level.pieces).sort();
  const budgets = pieceIds.map((p) => level.pieces[p] ?? 0);
  const placeable = pieceIds.map((p) => {
    if (!registry.pieceById.has(p)) throw new LevelError(`unknown piece "${p}"`);
    const ok = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (registry.tiles[tileOf[i] ?? 0]?.accepts.includes(p)) ok[i] = 1;
    return ok;
  });

  return {
    level,
    registry,
    ruleset,
    w,
    h,
    n,
    tileOf,
    charOf,
    walkable,
    cost,
    oneWay: b.oneWay,
    partner: b.partner,
    tunnelCost: b.tunnelCost,
    bonus: b.bonus,
    start,
    goals,
    isGoal,
    pieceIds,
    budgets,
    placeable,
  };
}
