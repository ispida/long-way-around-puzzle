/** Piece effect "block" (hedge): the cell can't be entered. */
import type { EffectModule } from "../types";

export const block: EffectModule = {
  type: "block",
  apply(cell, walkable) {
    walkable[cell] = 0;
  },
};
