/**
 * Solver results → stored solutions, for `npm run solve` (tools/solve.ts).
 *
 * solveInputs: fingerprint of everything a level's optimum depends on: the map, budgets, rule set, modifiers, the
 * definitions of the tiles and pieces it uses, and the engine version. Stored with a solution as
 * `inputs`; `npm run validate` reports a solution whose inputs changed.
 * Pictures, texts and display hints are left out: they don't change the optimum.
 */
import { createHash } from "node:crypto";
import {
  encodeSolution,
  ENGINE_VERSION,
  isValidPlacement,
  parseLevel,
  route,
  score,
  type Registry,
} from "@engine/index";
import { todayKey } from "@shared/dates";
import type { LevelJson, Solution } from "@shared/types";

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
    );
  return v;
}

export function solveInputs(registry: Registry, level: LevelJson): string {
  const chars = [...new Set(level.map.join(""))].sort();
  const tiles = chars.map((c) => {
    const t = registry.tiles[registry.tileByChar.get(c) ?? -1];
    return (
      t && {
        char: c,
        walkable: t.walkable,
        cost: t.cost,
        role: t.role,
        accepts: t.accepts,
        behaviors: t.behaviors,
      }
    );
  });
  const pieces = Object.keys(level.pieces)
    .sort()
    .map((id) => {
      const p = registry.pieces[registry.pieceById.get(id) ?? -1];
      return p && { id, effect: p.effect };
    });
  const data = {
    engine: ENGINE_VERSION,
    map: level.map,
    pieces: level.pieces,
    rules: registry.rulesets.get(level.rules),
    modifiers: level.modifiers,
    tiles,
    pieceDefs: pieces,
  };
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonical(data)))
    .digest("hex")}`;
}

/** What `python -m lws.cli solve` prints. */
export interface SolverResult {
  score: number;
  steps: number;
  bonus: number;
  placements: [number, string][];
  proven: boolean;
  bound: number;
  seconds: number;
  optimalLayouts?: number;
}

export class SolverMismatch extends Error {
  override name = "SolverMismatch";
}

/**
 * Re-scores the solver's layout with the engine and builds the `solution` to store.
 * Throws SolverMismatch if the layout breaks the rules or the engine scores it differently.
 */
export function solutionFor(
  registry: Registry,
  level: LevelJson,
  result: SolverResult,
  today: string = todayKey(),
): Solution {
  const board = parseLevel(registry, level);
  const placements = new Map(result.placements);
  if (!isValidPlacement(board, placements))
    throw new SolverMismatch(`${level.id}: solver layout breaks the rules`);
  const r = route(board, placements);
  const s = score(board, r);
  if (s !== result.score || r.steps !== result.steps || r.bonus !== result.bonus)
    throw new SolverMismatch(
      `${level.id}: engine scores the solver's layout ${s} (${r.steps} steps + ${r.bonus} bonus), ` +
        `solver claims ${result.score} (${result.steps} + ${result.bonus}); nothing written`,
    );
  return {
    score: s,
    proven: result.proven,
    data: encodeSolution(board, placements),
    method: "cp-sat",
    solvedAt: today,
    engineVersion: ENGINE_VERSION,
    inputs: solveInputs(registry, level),
  };
}
