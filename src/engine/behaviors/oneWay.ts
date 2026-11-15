/** One-way tiles (slopes / ice slides): moves onto or off the cell must go in its direction. */
import { DIR_BY_NAME } from "../grid";
import type { BehaviorModule } from "./types";

export const oneWay: BehaviorModule<"oneWay"> = {
  type: "oneWay",
  apply(b, cell, def) {
    b.oneWay[cell] = DIR_BY_NAME[def.dir];
  },
};
