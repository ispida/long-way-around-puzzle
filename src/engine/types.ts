/** Engine data structures. Boards are built once per level and treated as read-only afterwards. */
import type { LevelJson, RulesetDef } from "@shared/types";
import type { Registry } from "./content/registry";

export interface Board {
  readonly level: LevelJson;
  readonly registry: Registry;
  readonly ruleset: RulesetDef;
  readonly w: number;
  readonly h: number;
  readonly n: number;
  /** Tile index (into registry.tiles) per cell. */
  readonly tileOf: Uint16Array;
  /** Map character per cell (burrow pairs are told apart by it). */
  readonly charOf: readonly string[];
  readonly walkable: Uint8Array;
  /** Steps to enter the cell. */
  readonly cost: Uint8Array;
  /** 0 = free movement, else the only allowed direction onto and off the cell (grid.ts Dir). */
  readonly oneWay: Uint8Array;
  /** Linked tunnel cell or -1. */
  readonly partner: Int32Array;
  /** Steps for the tunnel hop that starts at this cell. */
  readonly tunnelCost: Uint8Array;
  /** Points for the player each time the route enters the cell. */
  readonly bonus: Int16Array;
  readonly start: number;
  readonly goals: readonly number[];
  readonly isGoal: Uint8Array;
  /** Piece ids used by the level, in a stable order (sorted). */
  readonly pieceIds: readonly string[];
  /** Budget per entry of pieceIds. */
  readonly budgets: readonly number[];
  /** Per entry of pieceIds: 1 where that piece may be placed. */
  readonly placeable: readonly Uint8Array[];
}

/** Player placements: cell index -> piece id. */
export type Placements = ReadonlyMap<number, string>;

export interface RouteStep {
  cell: number;
  via: "start" | "step" | "tunnel";
}

export interface RouteResult {
  /** False when the animal cannot reach any goal. */
  open: boolean;
  steps: number;
  /** Bonus points for the player collected along the route. */
  bonus: number;
  /** How often the route enters each tile type (start cell excluded). */
  visits: Record<string, number>;
  path: RouteStep[];
}
