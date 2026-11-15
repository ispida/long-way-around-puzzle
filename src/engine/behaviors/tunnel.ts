/** Tunnels (burrows / caves): two cells with the same map character are linked. */
import type { BehaviorModule, BoardBuilder } from "./types";

const pending = new WeakMap<BoardBuilder, Map<string, number[]>>();

export const tunnel: BehaviorModule<"tunnel"> = {
  type: "tunnel",
  apply(b, cell, def) {
    let groups = pending.get(b);
    if (!groups) pending.set(b, (groups = new Map<string, number[]>()));
    const key = b.charOf[cell] ?? "";
    const list = groups.get(key) ?? [];
    list.push(cell);
    groups.set(key, list);
    b.tunnelCost[cell] = def.cost;
  },
  finish(b) {
    for (const [char, cells] of pending.get(b) ?? []) {
      const [a, c] = cells;
      if (cells.length === 2 && a !== undefined && c !== undefined) {
        b.partner[a] = c;
        b.partner[c] = a;
      } else {
        b.errors.push({
          message: `portal "${char}" needs exactly 2 cells, found ${cells.length}`,
          cell: cells[0] ?? -1,
        });
      }
    }
    pending.delete(b);
  },
};
