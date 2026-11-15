/**
 * Stored optimal layouts. Placements are packed as 3 bytes each
 * (cell uint16 LE, piece index), XOR'd with a key from the level id and base64-encoded with a "b64:"
 * prefix. This only stops reading the answer at a glance; it is not a secret.
 */
import type { LevelJson, Solution } from "@shared/types";
import { parseLevel } from "./board";
import type { Registry } from "./content/registry";
import { isValidPlacement } from "./placement";
import { route } from "./route";
import { score } from "./score";
import type { Board, Placements } from "./types";

export class SolutionError extends Error {
  override name = "SolutionError";
}

function keyBytes(levelId: string): number[] {
  const k = [...`lwr:${levelId}`].map((c) => (c.charCodeAt(0) * 31 + 7) & 0xff);
  return k.length > 0 ? k : [0x5a];
}

export function encodeSolution(board: Board, placements: Placements): string {
  const key = keyBytes(board.level.id);
  const bytes: number[] = [];
  for (const [cell, piece] of [...placements].sort((a, b) => a[0] - b[0])) {
    const k = board.pieceIds.indexOf(piece);
    if (k < 0) throw new SolutionError(`piece "${piece}" is not used by level "${board.level.id}"`);
    bytes.push(cell & 0xff, cell >> 8, k);
  }
  const binary = bytes.map((b, i) => String.fromCharCode(b ^ (key[i % key.length] ?? 0))).join("");
  return `b64:${btoa(binary)}`;
}

export function decodeSolution(board: Board, data: string): Placements {
  if (!data.startsWith("b64:")) throw new SolutionError('solution data must start with "b64:"');
  let binary: string;
  try {
    binary = atob(data.slice(4));
  } catch {
    throw new SolutionError("solution data is not valid base64");
  }
  if (binary.length % 3 !== 0) throw new SolutionError("solution data has the wrong length");
  const key = keyBytes(board.level.id);
  const bytes = [...binary].map((c, i) => c.charCodeAt(0) ^ (key[i % key.length] ?? 0));
  const out = new Map<number, string>();
  for (let i = 0; i < bytes.length; i += 3) {
    const cell = (bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8);
    const piece = board.pieceIds[bytes[i + 2] ?? -1];
    if (cell >= board.n || piece === undefined)
      throw new SolutionError("solution data does not fit this level");
    if (out.has(cell)) throw new SolutionError("solution places two pieces on one cell");
    out.set(cell, piece);
  }
  return out;
}

export type VerifyResult = { ok: true; score: number } | { ok: false; reason: string };

/** Decodes the solution and checks it is allowed and scores exactly what it claims. */
export function verifySolution(board: Board, solution: Solution): VerifyResult {
  let placements: Placements;
  try {
    placements = decodeSolution(board, solution.data);
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  if (!isValidPlacement(board, placements))
    return { ok: false, reason: "solution breaks the budget or uses a forbidden cell" };
  const s = score(board, route(board, placements));
  if (s !== solution.score)
    return { ok: false, reason: `solution scores ${s}, but claims ${solution.score}` };
  return { ok: true, score: s };
}

/** The level with a new id; its stored solution is re-encoded so it still decodes (the key is the id). */
export function renameLevel(registry: Registry, level: LevelJson, id: string): LevelJson {
  if (level.id === id) return level;
  const renamed = { ...level, id };
  if (!level.solution) return renamed;
  const placements = decodeSolution(parseLevel(registry, level), level.solution.data);
  return {
    ...renamed,
    solution: { ...level.solution, data: encodeSolution(parseLevel(registry, renamed), placements) },
  };
}
