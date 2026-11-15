/** Public API of the engine. Code outside src/engine imports only from here. */
export const ENGINE_VERSION = 1;

export { buildRegistry, ContentError, type ContentDefs, type Registry } from "./content/registry";
export { parseLevel, LevelError } from "./board";
export { route, routeFast } from "./route";
export { score } from "./score";
export { ruleTag, RULE_GENERATIONS } from "./rule-tag";
export {
  canPlace,
  budgetLeft,
  countPieces,
  togglePlacement,
  isValidPlacement,
  type ToggleResult,
} from "./placement";
export { toCell, toIndex, type Cell } from "./grid";
export type { Board, Placements, RouteResult, RouteStep } from "./types";
export { validateLevel, type LevelIssue } from "./validate";
export {
  encodeSolution,
  decodeSolution,
  verifySolution,
  renameLevel,
  SolutionError,
  type VerifyResult,
} from "./solution";
export { createSearch, type Search, type SearchBest, type SearchOptions } from "./search/anneal";
export { createRng, type Rng } from "./search/rng";
