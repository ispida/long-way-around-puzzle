/**
 * Grid helpers. Directions are numbered 1..4 in the fixed neighbour order up, right, down, left
 *; 0 means "no direction".
 */
import type { BehaviorDef } from "@shared/types";

export const UP = 1;
export const RIGHT = 2;
export const DOWN = 3;
export const LEFT = 4;
export type Dir = typeof UP | typeof RIGHT | typeof DOWN | typeof LEFT;

type DirName = Extract<BehaviorDef, { type: "oneWay" }>["dir"];
export const DIR_BY_NAME: Record<DirName, Dir> = { up: UP, right: RIGHT, down: DOWN, left: LEFT };

export interface Cell {
  x: number;
  y: number;
}

export const toCell = (i: number, w: number): Cell => ({ x: i % w, y: Math.floor(i / w) });
export const toIndex = (x: number, y: number, w: number): number => y * w + x;

/** Neighbour of cell i in direction d, or -1 at the border. */
export function step(i: number, d: Dir, w: number, h: number): number {
  const x = i % w;
  switch (d) {
    case UP:
      return i >= w ? i - w : -1;
    case RIGHT:
      return x < w - 1 ? i + 1 : -1;
    case DOWN:
      return i < w * (h - 1) ? i + w : -1;
    case LEFT:
      return x > 0 ? i - 1 : -1;
  }
}
