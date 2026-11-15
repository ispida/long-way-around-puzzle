/**
 * The walk after Submit: the animal moves along its route; each step takes longer on costly tiles,
 * a tunnel hop is a quick jump, and the score counts up as it goes.
 */
import type { Board, RouteResult } from "@engine/index";

export const STEP_MS = 110;
export const TUNNEL_MS = 260;

export interface Timeline {
  /** Duration of the move into path[k] (index 0 = start, duration 0). */
  durations: number[];
  /** Points gained by the move into path[k]. */
  gains: number[];
  total: number;
}

export function timeline(board: Board, route: RouteResult): Timeline {
  const durations = [0];
  const gains = [0];
  for (let k = 1; k < route.path.length; k++) {
    const step = route.path[k];
    const prev = route.path[k - 1];
    if (!step || !prev) continue;
    if (step.via === "tunnel") {
      durations.push(TUNNEL_MS);
      gains.push((board.tunnelCost[prev.cell] ?? 0) + (board.bonus[step.cell] ?? 0));
    } else {
      const cost = board.cost[step.cell] ?? 1;
      durations.push(STEP_MS * cost);
      gains.push(cost + (board.bonus[step.cell] ?? 0));
    }
  }
  return { durations, gains, total: durations.reduce((a, b) => a + b, 0) };
}

export interface WalkFrame {
  /** Index of the last reached path entry. */
  k: number;
  /** Progress 0..1 towards path[k + 1]. */
  frac: number;
  /** Score counted so far. */
  score: number;
  done: boolean;
}

/** State of the walk `elapsed` ms after it started. */
export function frameAt(t: Timeline, elapsed: number): WalkFrame {
  let acc = 0;
  let score = 0;
  for (let k = 1; k < t.durations.length; k++) {
    const d = t.durations[k] ?? 0;
    if (elapsed < acc + d) return { k: k - 1, frac: (elapsed - acc) / d, score, done: false };
    acc += d;
    score += t.gains[k] ?? 0;
  }
  return { k: t.durations.length - 1, frac: 0, score, done: true };
}

/** Plays the walk with requestAnimationFrame; resolves when done or cancelled. */
export function playWalk(t: Timeline, onFrame: (f: WalkFrame) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const tick = (now: number) => {
      if (signal?.aborted) return resolve();
      const f = frameAt(t, now - start);
      onFrame(f);
      if (f.done) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
