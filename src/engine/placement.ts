/** Placing and removing player pieces (hedges, later puddles) within the level's budgets. */
import type { Board, Placements } from "./types";

export function canPlace(board: Board, cell: number, pieceId: string): boolean {
  const k = board.pieceIds.indexOf(pieceId);
  if (k < 0 || cell < 0 || cell >= board.n) return false;
  return board.placeable[k]?.[cell] === 1 && cell !== board.start && board.isGoal[cell] === 0;
}

export function countPieces(placements: Placements, pieceId: string): number {
  let c = 0;
  for (const p of placements.values()) if (p === pieceId) c++;
  return c;
}

export function budgetLeft(board: Board, placements: Placements, pieceId: string): number {
  const k = board.pieceIds.indexOf(pieceId);
  return k < 0 ? 0 : (board.budgets[k] ?? 0) - countPieces(placements, pieceId);
}

export type ToggleResult =
  | { ok: true; placements: Placements }
  | { ok: false; reason: "not-allowed" | "no-budget"; placements: Placements };

/**
 * Click behaviour: the same piece on the cell is removed; otherwise the piece is placed
 * (replacing a different piece) if the cell allows it and budget is left. Never mutates the input.
 */
export function togglePlacement(
  board: Board,
  placements: Placements,
  cell: number,
  pieceId: string,
): ToggleResult {
  const current = placements.get(cell);
  if (current === pieceId) {
    const next = new Map(placements);
    next.delete(cell);
    return { ok: true, placements: next };
  }
  if (!canPlace(board, cell, pieceId)) return { ok: false, reason: "not-allowed", placements };
  if (budgetLeft(board, placements, pieceId) <= 0) return { ok: false, reason: "no-budget", placements };
  const next = new Map(placements);
  next.set(cell, pieceId);
  return { ok: true, placements: next };
}

/** True if every placement is allowed and no budget is exceeded. */
export function isValidPlacement(board: Board, placements: Placements): boolean {
  for (const [cell, piece] of placements) if (!canPlace(board, cell, piece)) return false;
  return board.pieceIds.every((p) => budgetLeft(board, placements, p) >= 0);
}
