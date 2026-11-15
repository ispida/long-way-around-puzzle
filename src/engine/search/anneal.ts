/**
 * Heuristic layout search: the prototype's simulated annealing, generalised
 * to the level's piece budgets and made deterministic with a seed. Step-based, so a web worker can
 * run it in chunks and report progress. Finds strong layouts; does not prove they are optimal.
 */
import { canPlace } from "../placement";
import { routeFast } from "../route";
import { score } from "../score";
import type { Board, Placements, RouteResult } from "../types";
import { createRng, randInt, type Rng } from "./rng";

const CUT_OFF: RouteResult = { open: false, steps: 0, bonus: 0, visits: {}, path: [] };

export interface SearchOptions {
  seed: number;
  /** Layout to start from (e.g. the player's current hedges). */
  start?: Placements;
  /** Iterations per restart (prototype: 4000). */
  restartEvery?: number;
}

export interface SearchBest {
  placements: Placements;
  score: number;
}

export interface Search {
  /** Runs up to `iterations` more iterations. */
  step(iterations: number): void;
  best(): SearchBest;
  readonly iterations: number;
}

/** A layout as parallel arrays: cells[i] holds a piece of type kinds[i] (index into board.pieceIds). */
interface Layout {
  cells: number[];
  kinds: number[];
}

export function createSearch(board: Board, opts: SearchOptions): Search {
  const rng: Rng = createRng(opts.seed);
  const restartEvery = opts.restartEvery ?? 4000;
  const kindsCount = board.pieceIds.length;
  const cand = board.pieceIds.map((p) => {
    const out: number[] = [];
    for (let i = 0; i < board.n; i++) if (canPlace(board, i, p)) out.push(i);
    return out;
  });

  const toMap = (l: Layout): Placements =>
    new Map(l.cells.map((c, i) => [c, board.pieceIds[l.kinds[i] ?? 0] ?? ""]));
  const fromMap = (m: Placements): Layout => {
    const l: Layout = { cells: [], kinds: [] };
    for (const [c, p] of m) {
      const k = board.pieceIds.indexOf(p);
      if (k >= 0 && canPlace(board, c, p)) {
        l.cells.push(c);
        l.kinds.push(k);
      }
    }
    return l;
  };
  const copy = (l: Layout): Layout => ({ cells: l.cells.slice(), kinds: l.kinds.slice() });
  const used = (l: Layout, k: number) => l.kinds.reduce((a, x) => a + (x === k ? 1 : 0), 0);
  /** Score and route cells of a layout, without building a Map or a RouteResult. */
  const evaluate = (l: Layout) => {
    const path: number[] = [];
    const v = routeFast(board, l.cells, l.kinds, path);
    const sc = v >= 0 ? v : score(board, CUT_OFF);
    return { score: sc, path };
  };

  const start = fromMap(opts.start ?? new Map());
  let best = copy(start);
  let bestScore = evaluate(best).score;

  let restart = 0;
  let inRestart = 0;
  let cur = copy(start);
  let curEval = evaluate(cur);
  let temp = 3;
  let total = 0;

  const beginRestart = () => {
    cur = restart === 0 ? copy(start) : restart % 2 ? copy(best) : { cells: [], kinds: [] };
    curEval = evaluate(cur);
    temp = 3;
    inRestart = 0;
  };

  /** A cell for piece kind k: 60% from the current route (where pieces matter), else anywhere allowed. */
  const pick = (k: number, l: Layout): number => {
    const onPath = curEval.path.filter(
      (c) => canPlace(board, c, board.pieceIds[k] ?? "") && !l.cells.includes(c),
    );
    const list = cand[k] ?? [];
    if (onPath.length > 0 && rng() < 0.6) return onPath[randInt(rng, onPath.length)] ?? -1;
    return list.length > 0 ? (list[randInt(rng, list.length)] ?? -1) : -1;
  };

  const iterate = () => {
    const next = copy(cur);
    const r = rng();
    const free = [];
    for (let k = 0; k < kindsCount; k++) if (used(next, k) < (board.budgets[k] ?? 0)) free.push(k);

    if (free.length > 0 && r < 0.45) {
      const k = free[randInt(rng, free.length)] ?? 0;
      const c = pick(k, next);
      if (c >= 0 && !next.cells.includes(c)) {
        next.cells.push(c);
        next.kinds.push(k);
      }
    } else if (next.cells.length > 0 && r < 0.92) {
      const at = randInt(rng, next.cells.length);
      const c = pick(next.kinds[at] ?? 0, next);
      if (c >= 0 && !next.cells.includes(c)) next.cells[at] = c;
    } else if (next.cells.length > 0) {
      const at = randInt(rng, next.cells.length);
      next.cells.splice(at, 1);
      next.kinds.splice(at, 1);
    }

    const e = evaluate(next);
    if (e.score >= curEval.score || rng() < Math.exp((e.score - curEval.score) / temp)) {
      cur = next;
      curEval = e;
    }
    if (curEval.score > bestScore) {
      bestScore = curEval.score;
      best = copy(cur);
    }
    temp = Math.max(0.05, temp * 0.999);
  };

  return {
    step(iterations) {
      for (let i = 0; i < iterations; i++) {
        if (inRestart === restartEvery) {
          restart++;
          beginRestart();
        }
        iterate();
        inRestart++;
        total++;
      }
    },
    best: () => ({ placements: toMap(best), score: bestScore }),
    get iterations() {
      return total;
    },
  };
}
