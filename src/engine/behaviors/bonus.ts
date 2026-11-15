/** Bonus tiles (beehive): points for the player each time the route enters the cell. */
import type { BehaviorModule } from "./types";

export const bonus: BehaviorModule<"bonus"> = {
  type: "bonus",
  apply(b, cell, def) {
    b.bonus[cell] = def.points;
  },
};
