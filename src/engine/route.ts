/**
 * The animal's route: Dijkstra from the start to the nearest goal. It saves as little as it can
 *: it minimises the score, steps + bonus, so a hive (+5) counts like 5 more
 * steps; among routes with the same score it takes the one with the fewest bonus points, walking
 * around the bees rather than through them. Without bonus tiles this is simply the shortest route.
 */
import { effectFor, type EffectModule } from "./behaviors";
import { step, type Dir } from "./grid";
import type { Board, Placements, RouteResult, RouteStep } from "./types";

const INF = 0x3fffffff;
const VIA_STEP = 1;
const VIA_TUNNEL = 2;
const DIRS: readonly Dir[] = [1, 2, 3, 4];

/** Reusable buffers per board, so route() allocates almost nothing (search calls it ~100k times). */
interface Scratch {
  walk: Uint8Array;
  cost: Uint8Array;
  distS: Int32Array;
  distB: Int32Array;
  prev: Int32Array;
  via: Uint8Array;
  heap: MinHeap;
  effects: Map<string, EffectModule>;
  /** Effects in board.pieceIds order, for routeFast(). */
  effectByKind: (EffectModule | undefined)[];
}
const scratch = new WeakMap<Board, Scratch>();

function getScratch(board: Board): Scratch {
  let s = scratch.get(board);
  if (!s) {
    const effects = new Map<string, EffectModule>();
    for (const id of board.pieceIds) {
      const def = board.registry.pieces[board.registry.pieceById.get(id) ?? -1];
      if (def) effects.set(id, effectFor(def));
    }
    s = {
      walk: new Uint8Array(board.n),
      cost: new Uint8Array(board.n),
      distS: new Int32Array(board.n),
      distB: new Int32Array(board.n),
      prev: new Int32Array(board.n),
      via: new Uint8Array(board.n),
      heap: new MinHeap(board.n),
      effects,
      effectByKind: board.pieceIds.map((id) => effects.get(id)),
    };
    scratch.set(board, s);
  }
  return s;
}

export function route(board: Board, placements: Placements = new Map()): RouteResult {
  const s = getScratch(board);
  s.walk.set(board.walkable);
  s.cost.set(board.cost);
  for (const [cell, piece] of placements) s.effects.get(piece)?.apply(cell, s.walk, s.cost);
  const goal = dijkstra(board, s);
  if (goal < 0) return { open: false, steps: 0, bonus: 0, visits: {}, path: [] };
  const total = s.distS[goal] ?? 0;
  const bonus = s.distB[goal] ?? 0;
  return result(board, goal, total - bonus, bonus, s.prev, s.via);
}

/**
 * Allocation-free variant for the search: pieces as parallel arrays (cell, index into board.pieceIds),
 * the route's cells (start to goal) written into `path` (cleared first; empty if cut off).
 * Returns steps + bonus, or -1 if the animal is cut off. Same result as route().
 */
export function routeFast(
  board: Board,
  cells: readonly number[],
  kinds: readonly number[],
  path: number[],
): number {
  const s = getScratch(board);
  s.walk.set(board.walkable);
  s.cost.set(board.cost);
  for (let i = 0; i < cells.length; i++) s.effectByKind[kinds[i] ?? -1]?.apply(cells[i] ?? 0, s.walk, s.cost);
  path.length = 0;
  const goal = dijkstra(board, s);
  if (goal < 0) return -1;
  for (let c = goal; c !== -1; c = s.prev[c] ?? -1) path.push(c);
  path.reverse();
  return s.distS[goal] ?? 0;
}

/**
 * Dijkstra on [steps + bonus, bonus] over scratch.walk/cost (distS holds the total, the score so far);
 * returns the goal reached or -1.
 */
function dijkstra(board: Board, s: Scratch): number {
  const { w, h, oneWay, partner, tunnelCost, bonus, isGoal, start } = board;
  const { walk, cost, distS, distB, prev, via, heap } = s;
  distS.fill(INF);
  distB.fill(INF);
  prev.fill(-1);
  via.fill(0);
  heap.clear();

  distS[start] = 0;
  distB[start] = 0;
  heap.push(0, 0, start);

  while (heap.size > 0) {
    const i = heap.pop();
    const si = heap.lastS;
    const bi = heap.lastB;
    if (si !== distS[i] || bi !== distB[i]) continue; // stale entry
    if (isGoal[i]) return i;

    const oi = oneWay[i] ?? 0;
    for (const d of DIRS) {
      const j = step(i, d, w, h);
      if (j < 0 || !walk[j]) continue;
      if (oi !== 0 && oi !== d) continue;
      const oj = oneWay[j] ?? 0;
      if (oj !== 0 && oj !== d) continue;
      const nb = bi + (bonus[j] ?? 0);
      const ns = si + (cost[j] ?? 0) + (bonus[j] ?? 0);
      const cs = distS[j] ?? INF;
      if (ns < cs || (ns === cs && nb < (distB[j] ?? INF))) {
        distS[j] = ns;
        distB[j] = nb;
        prev[j] = i;
        via[j] = VIA_STEP;
        heap.push(ns, nb, j);
      }
    }
    const p = partner[i] ?? -1;
    if (p >= 0 && walk[p]) {
      const nb = bi + (bonus[p] ?? 0);
      const ns = si + (tunnelCost[i] ?? 0) + (bonus[p] ?? 0);
      const cs = distS[p] ?? INF;
      if (ns < cs || (ns === cs && nb < (distB[p] ?? INF))) {
        distS[p] = ns;
        distB[p] = nb;
        prev[p] = i;
        via[p] = VIA_TUNNEL;
        heap.push(ns, nb, p);
      }
    }
  }
  return -1;
}

function result(
  board: Board,
  goal: number,
  steps: number,
  bonus: number,
  prev: Int32Array,
  via: Uint8Array,
): RouteResult {
  const path: RouteStep[] = [];
  const visits: Record<string, number> = {};
  for (let c = goal; c !== -1; c = prev[c] ?? -1) {
    const how = via[c];
    path.push({ cell: c, via: how === VIA_TUNNEL ? "tunnel" : how === VIA_STEP ? "step" : "start" });
    if (c !== board.start) {
      const id = board.registry.tiles[board.tileOf[c] ?? 0]?.id ?? "?";
      visits[id] = (visits[id] ?? 0) + 1;
    }
  }
  path.reverse();
  return { open: true, steps, bonus, visits, path };
}

/**
 * Binary min-heap on (steps, bonus) pairs in typed arrays; pop() returns the cell and sets lastS/lastB.
 * Grows if needed (a cell can be pushed more than once), so it never allocates per call after warm-up.
 */
class MinHeap {
  private s: Int32Array;
  private b: Int32Array;
  private c: Int32Array;
  size = 0;
  lastS = 0;
  lastB = 0;

  constructor(capacity: number) {
    const n = Math.max(16, capacity * 2);
    this.s = new Int32Array(n);
    this.b = new Int32Array(n);
    this.c = new Int32Array(n);
  }
  clear(): void {
    this.size = 0;
  }
  private grow(): void {
    const n = this.c.length * 2;
    const s = new Int32Array(n);
    const b = new Int32Array(n);
    const c = new Int32Array(n);
    s.set(this.s);
    b.set(this.b);
    c.set(this.c);
    this.s = s;
    this.b = b;
    this.c = c;
  }
  push(steps: number, bonus: number, cell: number): void {
    if (this.size === this.c.length) this.grow();
    const { s, b, c } = this;
    let k = this.size++;
    // Sift up: move parents down until the new entry's place is found.
    while (k > 0) {
      const p = (k - 1) >> 1;
      const sp = s[p] ?? 0;
      if (sp < steps || (sp === steps && (b[p] ?? 0) <= bonus)) break;
      s[k] = sp;
      b[k] = b[p] ?? 0;
      c[k] = c[p] ?? 0;
      k = p;
    }
    s[k] = steps;
    b[k] = bonus;
    c[k] = cell;
  }
  pop(): number {
    const { s, b, c } = this;
    this.lastS = s[0] ?? 0;
    this.lastB = b[0] ?? 0;
    const top = c[0] ?? -1;
    const len = --this.size;
    if (len === 0) return top;
    // Sift the last entry down from the root.
    const ls = s[len] ?? 0;
    const lb = b[len] ?? 0;
    const lc = c[len] ?? 0;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1;
      if (l >= len) break;
      const r = l + 1;
      let m = l;
      if (
        r < len &&
        ((s[r] ?? 0) < (s[l] ?? 0) || ((s[r] ?? 0) === (s[l] ?? 0) && (b[r] ?? 0) < (b[l] ?? 0)))
      )
        m = r;
      const sm = s[m] ?? 0;
      if (ls < sm || (ls === sm && lb <= (b[m] ?? 0))) break;
      s[k] = sm;
      b[k] = b[m] ?? 0;
      c[k] = c[m] ?? 0;
      k = m;
    }
    s[k] = ls;
    b[k] = lb;
    c[k] = lc;
    return top;
  }
}
