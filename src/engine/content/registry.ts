/**
 * Registry: the loaded tile, piece and rule-set definitions with fast lookups.
 * The engine never reads files; callers pass parsed content.
 */
import type { PieceDef, RulesetDef, TileDef } from "@shared/types";

export interface ContentDefs {
  tiles: readonly TileDef[];
  pieces: readonly PieceDef[];
  rulesets: readonly RulesetDef[];
}

export interface Registry {
  readonly tiles: readonly TileDef[];
  readonly pieces: readonly PieceDef[];
  /** Map character -> tile index. */
  readonly tileByChar: ReadonlyMap<string, number>;
  readonly tileById: ReadonlyMap<string, number>;
  readonly pieceById: ReadonlyMap<string, number>;
  readonly rulesets: ReadonlyMap<string, RulesetDef>;
}

export class ContentError extends Error {
  override name = "ContentError";
}

export function buildRegistry(defs: ContentDefs): Registry {
  const tileByChar = new Map<string, number>();
  const tileById = new Map<string, number>();
  defs.tiles.forEach((t, i) => {
    if (tileById.has(t.id)) throw new ContentError(`duplicate tile id "${t.id}"`);
    tileById.set(t.id, i);
    for (const c of t.chars) {
      const owner = tileByChar.get(c);
      if (owner !== undefined) {
        throw new ContentError(`map character "${c}" used by "${defs.tiles[owner]?.id}" and "${t.id}"`);
      }
      tileByChar.set(c, i);
    }
  });
  const pieceById = new Map<string, number>();
  defs.pieces.forEach((p, i) => {
    if (pieceById.has(p.id)) throw new ContentError(`duplicate piece id "${p.id}"`);
    pieceById.set(p.id, i);
  });
  for (const t of defs.tiles) {
    for (const p of t.accepts)
      if (!pieceById.has(p)) throw new ContentError(`tile "${t.id}" accepts unknown piece "${p}"`);
  }
  const rulesets = new Map(defs.rulesets.map((r) => [r.id, r]));
  return { tiles: defs.tiles, pieces: defs.pieces, tileByChar, tileById, pieceById, rulesets };
}
