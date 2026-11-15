/**
 * Content types. They are inferred from the runtime schemas in `schemas.ts`,
 * so the TypeScript types and the validation can never disagree.
 */
import type { z } from "zod";
import type {
  BehaviorSchema,
  CampaignSchema,
  LevelSchema,
  PieceSchema,
  RulesetSchema,
  SolutionSchema,
  ThemeSchema,
  TileSchema,
} from "./schemas";

export type BehaviorDef = z.infer<typeof BehaviorSchema>;
export type TileDef = z.infer<typeof TileSchema>;
export type PieceDef = z.infer<typeof PieceSchema>;
export type RulesetDef = z.infer<typeof RulesetSchema>;
export type ThemeDef = z.infer<typeof ThemeSchema>;
export type Solution = z.infer<typeof SolutionSchema>;
export type LevelJson = z.infer<typeof LevelSchema>;
export type CampaignJson = z.infer<typeof CampaignSchema>;
