/**
 * validateLevel: every problem with a level, each with the cell it concerns where that applies
 * (the editor highlights it). Never throws.
 */
import type { LevelJson } from "@shared/types";
import { LevelError, parseLevel } from "./board";
import type { Registry } from "./content/registry";
import { toCell, type Cell } from "./grid";
import { route } from "./route";
import { score } from "./score";
import { verifySolution } from "./solution";

export interface LevelIssue {
  message: string;
  cell?: Cell;
}

export function validateLevel(registry: Registry, level: LevelJson): LevelIssue[] {
  const issues: LevelIssue[] = [];
  const w = level.map[0]?.length ?? 0;
  const at = (i: number): { cell?: Cell } => (i >= 0 && w > 0 ? { cell: toCell(i, w) } : {});

  const unknown = new Map<string, number>();
  const starts: number[] = [];
  let goals = 0;
  level.map.forEach((row, y) => {
    [...row].forEach((c, x) => {
      const i = y * w + x;
      const t = registry.tileByChar.get(c);
      if (t === undefined) {
        if (!unknown.has(c)) unknown.set(c, i);
        return;
      }
      const role = registry.tiles[t]?.role;
      if (role === "start") starts.push(i);
      if (role === "goal") goals++;
    });
  });
  for (const [c, i] of unknown) issues.push({ message: `unknown map character "${c}"`, ...at(i) });
  if (starts.length === 0) issues.push({ message: "the level has no start" });
  for (const i of starts.slice(1)) issues.push({ message: "more than one start", ...at(i) });
  if (goals === 0) issues.push({ message: "the level has no goal" });
  for (const p of Object.keys(level.pieces)) {
    if (!registry.pieceById.has(p)) issues.push({ message: `unknown piece "${p}"` });
  }
  if (!Object.values(level.pieces).some((n) => n > 0))
    issues.push({ message: "the level gives the player no pieces" });
  if (!registry.rulesets.has(level.rules)) issues.push({ message: `unknown rule set "${level.rules}"` });
  if (issues.length > 0) return issues;

  let board;
  try {
    board = parseLevel(registry, level);
  } catch (e) {
    if (e instanceof LevelError) return [{ message: e.message, ...at(e.cell ?? -1) }];
    throw e;
  }

  const start = route(board);
  if (!start.open)
    issues.push({ message: "the start is cut off from every goal on the empty board", ...at(board.start) });
  const startScore = score(board, start);
  if (level.startScore !== undefined && level.startScore !== startScore) {
    issues.push({ message: `startScore is ${level.startScore}, but the level starts at ${startScore}` });
  }
  if (level.solution) {
    const v = verifySolution(board, level.solution);
    if (!v.ok) issues.push({ message: `solution: ${v.reason}` });
    else if (v.score < startScore)
      issues.push({ message: `solution scores ${v.score}, below the start score ${startScore}` });
  }
  return issues;
}
