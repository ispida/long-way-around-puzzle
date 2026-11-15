/** Score of a route under the level's rule set. */
import type { Board, RouteResult } from "./types";

export function score(board: Board, r: RouteResult): number {
  if (r.open) return r.steps + r.bonus;
  switch (board.ruleset.onCutOff) {
    case "zero":
      return 0;
    case "breakThrough":
      throw new Error('rule set "breakThrough" is not implemented yet');
  }
}
