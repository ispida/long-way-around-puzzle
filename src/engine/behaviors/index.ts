/** Behaviour and effect registries, keyed by the `type` used in content JSON. */
import type { BehaviorDef, PieceDef } from "@shared/types";
import { bonus } from "./bonus";
import { block } from "./effects/block";
import { setCost } from "./effects/setCost";
import { oneWay } from "./oneWay";
import { tunnel } from "./tunnel";
import type { BehaviorModule, EffectModule } from "./types";

export const BEHAVIORS: { [T in BehaviorDef["type"]]: BehaviorModule<T> } = { oneWay, tunnel, bonus };

export function effectFor(piece: PieceDef): EffectModule {
  switch (piece.effect.type) {
    case "block":
      return block;
    case "setCost":
      return setCost(piece.effect);
  }
}

export type { BehaviorModule, BoardBuilder, EffectModule } from "./types";
