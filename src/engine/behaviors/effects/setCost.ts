/** Piece effect "setCost" (puddle): entering the cell costs a fixed number of steps. */
import type { PieceDef } from "@shared/types";
import type { EffectModule } from "../types";

type SetCost = Extract<PieceDef["effect"], { type: "setCost" }>;

export function setCost(def: SetCost): EffectModule {
  return {
    type: "setCost",
    apply(cell, _walkable, cost) {
      cost[cell] = def.cost;
    },
  };
}
