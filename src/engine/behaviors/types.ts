/** Contracts for behaviour modules (tile behaviours) and piece effect modules. */
import type { BehaviorDef } from "@shared/types";

/** Mutable view of the board arrays while a level is being parsed. */
export interface BoardBuilder {
  w: number;
  h: number;
  charOf: readonly string[];
  oneWay: Uint8Array;
  partner: Int32Array;
  tunnelCost: Uint8Array;
  bonus: Int16Array;
  /** Problems found while building, e.g. an unpaired tunnel. */
  errors: { message: string; cell?: number }[];
}

export interface BehaviorModule<T extends BehaviorDef["type"] = BehaviorDef["type"]> {
  type: T;
  /** Called once per cell that has this behaviour. */
  apply(b: BoardBuilder, cell: number, def: Extract<BehaviorDef, { type: T }>): void;
  /** Called once after all cells, e.g. to pair tunnels. */
  finish?(b: BoardBuilder): void;
}

/** Applies a placed piece to the working copy of walkable/cost used by one route call. */
export interface EffectModule {
  type: string;
  apply(cell: number, walkable: Uint8Array, cost: Uint8Array): void;
}
