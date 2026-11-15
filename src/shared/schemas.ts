/**
 * Runtime schemas for all content files.
 * Shared by the client and the tools.
 */
import { z } from "zod";
import { isIsoDate } from "./dates";

const Id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase letters, digits and dashes");
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "use a #rrggbb colour");
const IsoDate = z.string().refine(isIsoDate, "use a real date in YYYY-MM-DD form");
const Direction = z.enum(["up", "down", "left", "right"]);

/* ---------- tiles ---------- */

/** Behaviour types the engine knows. Each has a module in src/engine/behaviors and solver/lws/behaviors. */
export const BehaviorSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("oneWay"), dir: Direction }),
  z.strictObject({ type: z.literal("tunnel"), pairBy: z.literal("char"), cost: z.int().min(0) }),
  z.strictObject({ type: z.literal("bonus"), points: z.int() }),
]);
export const BEHAVIOR_TYPES = BehaviorSchema.options.map((o) => o.shape.type.value);

export const TileSchema = z.strictObject({
  id: Id,
  chars: z.array(z.string().length(1)).min(1),
  walkable: z.boolean(),
  cost: z.int().min(1).default(1),
  role: z.enum(["start", "goal"]).optional(),
  accepts: z.array(Id).default([]),
  behaviors: z.array(BehaviorSchema).default([]),
  nameKey: z.string().optional(),
  editor: z.strictObject({
    group: z.enum(["terrain", "obstacle", "special", "actor"]),
    order: z.int(),
    hidden: z.boolean().optional(),
  }),
  card: z
    .strictObject({
      title: z.string(),
      text: z.string(),
      /** Small example board for the rulebook, drawn with the real engine. */
      example: z
        .strictObject({
          map: z.array(z.string().min(1)).min(1),
          hedges: z.array(z.tuple([z.int().min(0), z.int().min(0)])).default([]),
        })
        .optional(),
    })
    .optional(),
  image: z
    .strictObject({
      base: Id.optional(),
      rotate: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
      tintBy: z.literal("char").optional(),
    })
    .optional(),
});

/* ---------- pieces ---------- */

export const PieceEffectSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("block") }),
  z.strictObject({ type: z.literal("setCost"), cost: z.int().min(1) }),
]);

export const PieceSchema = z.strictObject({
  id: Id,
  effect: PieceEffectSchema,
  editor: z.strictObject({ order: z.int(), hidden: z.boolean().optional() }),
});

/* ---------- rule sets ---------- */

export const RulesetSchema = z.strictObject({
  id: Id,
  onCutOff: z.enum(["zero", "breakThrough"]),
  breakCost: z.int().min(1).optional(),
  goal: z.enum(["nearest"]),
  animals: z.int().min(1).max(4).default(1),
  score: z.enum(["single", "sum"]).default("single"),
});

/* ---------- themes ---------- */

export const ThemeSchema = z.strictObject({
  id: Id,
  name: z.string().min(1),
  extends: Id.optional(),
  words: z.record(z.string(), z.string()).default({}),
  palette: z.record(z.string(), Hex).default({}),
  tileSize: z.int().min(16).max(512).default(128),
  /** Position in the theme picker (lower first). */
  order: z.int().optional(),
});

/* ---------- levels ---------- */

export const SolutionSchema = z.strictObject({
  score: z.int().min(0),
  proven: z.boolean(),
  data: z.string().startsWith("b64:"),
  method: z.enum(["cp-sat", "heuristic"]),
  solvedAt: IsoDate,
  engineVersion: z.int().min(1),
  /** Hash of everything the optimum depends on (tools/solution.ts); `npm run validate` flags stale ones. */
  inputs: z
    .string()
    .regex(/^sha256:[0-9a-f]{64}$/)
    .optional(),
});

export const LevelSchema = z
  .strictObject({
    schema: z.literal(1),
    id: Id,
    name: z.string().min(1),
    tag: z.string().min(1),
    text: z.string(),
    map: z.array(z.string().min(1)).min(1),
    pieces: z.record(Id, z.int().min(0)),
    rules: Id.default("default"),
    modifiers: z.array(Id).default([]),
    startScore: z.int().min(0).optional(),
    solution: SolutionSchema.nullable().optional(),
  })
  .refine((l) => l.map.every((row) => row.length === l.map[0]?.length), {
    message: "all map rows must have the same length",
    path: ["map"],
  });

export const CampaignSchema = z.strictObject({
  levels: z.array(Id).min(1).max(20),
  unlock: z.enum(["sequential", "all"]),
  /** Raised when the levels are redrawn: players' progress on an older campaign is archived. */
  version: z.int().min(1).default(1),
});
