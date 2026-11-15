/**
 * JSON bridge to the TypeScript engine for the Python solver's tests and the cross-check
 *. Reads one JSON request array from stdin, writes one JSON array:
 *   { "cmd": "board", "level": LevelJson }                 → the board facts the solver must reproduce
 *   { "cmd": "score", "level": LevelJson, "placements": [[cell, piece], …] } → { open, steps, bonus, score }
 *   { "cmd": "brute", "level": LevelJson }                 → best score over EVERY layout, and how many reach it
 *   { "cmd": "random", "seed": n, "count": n }             → random small levels (all tile types)
 */
import { readFileSync } from "node:fs";
import { canPlace, createRng, parseLevel, route, score, type Board, type Placements } from "@engine/index";
import { LevelSchema } from "@shared/schemas";
import type { LevelJson } from "@shared/types";
import { CONTENT_DIR, loadContent } from "./content-io";

const { registry } = loadContent(CONTENT_DIR, { ignoreSolutions: true });

type Request =
  | { cmd: "board"; level: unknown }
  | { cmd: "score"; level: unknown; placements: [number, string][] }
  | { cmd: "brute"; level: unknown }
  | { cmd: "random"; seed: number; count: number };

export function boardFacts(b: Board) {
  return {
    w: b.w,
    h: b.h,
    walkable: [...b.walkable],
    cost: [...b.cost],
    oneWay: [...b.oneWay],
    partner: [...b.partner],
    tunnelCost: [...b.tunnelCost],
    bonus: [...b.bonus],
    start: b.start,
    goals: [...b.goals],
    pieceIds: [...b.pieceIds],
    budgets: [...b.budgets],
    placeable: Object.fromEntries(
      b.pieceIds.map((p) => [p, Array.from({ length: b.n }, (_, i) => i).filter((i) => canPlace(b, i, p))]),
    ),
  };
}

export function scoreOf(b: Board, placements: Placements) {
  const r = route(b, placements);
  return { open: r.open, steps: r.steps, bonus: r.bonus, score: score(b, r) };
}

/** Best score over every layout within the budget (single piece type). Exponential: small boards only. */
export function bruteForce(b: Board): {
  score: number;
  placements: [number, string][];
  layouts: number;
  optimal: number;
} {
  const piece = b.pieceIds[0] ?? "hedge";
  const budget = b.budgets[0] ?? 0;
  const cells = Array.from({ length: b.n }, (_, i) => i).filter((i) => canPlace(b, i, piece));
  let best = { score: scoreOf(b, new Map()).score, placements: [] as [number, string][] };
  let layouts = 0;
  let optimal = 0;
  const chosen: number[] = [];
  const visit = (from: number) => {
    layouts++;
    const m = new Map(chosen.map((c) => [c, piece]));
    const s = scoreOf(b, m).score;
    if (s > best.score) {
      best = { score: s, placements: chosen.map((c) => [c, piece]) };
      optimal = 0;
    }
    if (s === best.score) optimal++;
    if (chosen.length === budget) return;
    for (let i = from; i < cells.length; i++) {
      chosen.push(cells[i] as number);
      visit(i + 1);
      chosen.pop();
    }
  };
  visit(0);
  return { ...best, layouts, optimal };
}

/** Random small levels using every tile type; always solvable at start. */
export function randomLevels(seed: number, count: number): LevelJson[] {
  const rng = createRng(seed);
  const out: LevelJson[] = [];
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)] as T;
  while (out.length < count) {
    const w = 3 + Math.floor(rng() * 4); // 3..6
    const h = 2 + Math.floor(rng() * 4); // 2..5
    const cells: string[] = Array.from({ length: w * h }, () => {
      const r = rng();
      return r < 0.55
        ? "."
        : r < 0.65
          ? "T"
          : r < 0.72
            ? "m"
            : r < 0.77
              ? "Q"
              : r < 0.8
                ? "~"
                : pick([">", "<", "^", "v"]);
    });
    const free = () => {
      for (;;) {
        const i = Math.floor(rng() * cells.length);
        if (cells[i] !== "B" && cells[i] !== "H" && !/[1-9]/.test(cells[i] as string)) return i;
      }
    };
    cells[free()] = "B";
    cells[free()] = "H";
    if (rng() < 0.3) cells[free()] = "H";
    if (rng() < 0.4 && w * h >= 8) {
      cells[free()] = "1";
      cells[free()] = "1";
    }
    const map = Array.from({ length: h }, (_, y) => cells.slice(y * w, y * w + w).join(""));
    const budget = 1 + Math.floor(rng() * 3);
    const level = LevelSchema.parse({
      schema: 1,
      id: `rnd-${seed}-${out.length}`,
      name: "Random",
      tag: "Random",
      text: "",
      map,
      pieces: { hedge: budget },
    });
    try {
      const b = parseLevel(registry, level);
      if (route(b).open) out.push(level);
    } catch {
      // e.g. a burrow digit used once by chance: skip
    }
  }
  return out;
}

function handle(req: Request): unknown {
  if (req.cmd === "random") return randomLevels(req.seed, req.count);
  const b = parseLevel(registry, LevelSchema.parse(req.level));
  if (req.cmd === "board") return boardFacts(b);
  if (req.cmd === "score") return scoreOf(b, new Map(req.placements));
  return bruteForce(b);
}

if (process.argv[1]?.endsWith("engine-cli.ts")) {
  const requests = JSON.parse(readFileSync(0, "utf8")) as Request[];
  process.stdout.write(JSON.stringify(requests.map(handle)));
}
