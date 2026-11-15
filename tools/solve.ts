/**
 * `npm run solve -- <level.json …> | --campaign [--time 120] [--workers N] [--method model|layers]`
 * (--method layers for large boards).
 *
 * For each level: a short heuristic search gives the solver a starting layout, the CP-SAT solver
 * (solver/, run with uv) finds the best layout, the TypeScript engine re-scores it, and only if the
 * engine agrees exactly is `solution` written into the level file. A stored solution for unchanged
 * inputs is only replaced by a better or newly proven one.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import { createSearch, parseLevel, type Board, type Registry } from "@engine/index";
import { CampaignSchema, LevelSchema } from "@shared/schemas";
import type { LevelJson } from "@shared/types";
import { CONTENT_DIR, loadContent } from "./content-io";
import { solutionFor, type SolverResult } from "./solution";

export type { SolverResult };

const SOLVER_DIR = fileURLToPath(new URL("../solver", import.meta.url));

export interface SolveOptions {
  time?: number;
  workers?: number;
  countOptimal?: number;
  /** Milliseconds of heuristic search for the starting layout (0 = none). */
  hintMs?: number;
  /** "model" (default): the all-at-once CP-SAT model; "layers": yes/no questions, for large boards. */
  method?: "model" | "layers";
}

/** Runs the Python solver on one level. */
export function runSolver(
  level: LevelJson,
  opts: SolveOptions = {},
  hint?: [number, string][],
): SolverResult {
  const args = ["run", "--quiet", "--project", SOLVER_DIR, "python", "-m", "lws.cli", "solve", "-"];
  args.push("--time", String(opts.time ?? 120));
  if (opts.workers) args.push("--workers", String(opts.workers));
  if (opts.countOptimal) args.push("--count-optimal", String(opts.countOptimal));
  if (opts.method === "layers") args.push("--method", "layers");
  if (!hint || hint.length === 0) return exec(args, JSON.stringify(level));
  const dir = mkdtempSync(join(tmpdir(), "lwr-solve-"));
  try {
    const file = join(dir, "hint.json");
    writeFileSync(file, JSON.stringify(hint));
    return exec([...args, "--hint", file], JSON.stringify(level));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function exec(args: string[], input: string): SolverResult {
  return runLws(args.slice(args.indexOf("lws.cli") + 1), input) as SolverResult;
}

/** Runs `python -m lws.cli <args>` in the solver project with uv; returns the parsed JSON output. */
export function runLws(args: string[], input: string): unknown {
  const cmd = ["run", "--quiet", "--project", SOLVER_DIR, "python", "-m", "lws.cli", ...args];
  const r = spawnSync("uv", cmd, { cwd: SOLVER_DIR, input, encoding: "utf8", maxBuffer: 1 << 24 });
  if (r.error) throw new Error(`could not start uv (is it installed?): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`solver failed (exit ${r.status}): ${r.stderr.trim()}`);
  return JSON.parse(r.stdout) as unknown;
}

/** Best layout the heuristic search finds in `ms` milliseconds. */
export function quickSearch(board: Board, ms: number): { score: number; placements: [number, string][] } {
  const search = createSearch(board, { seed: 1 });
  const end = Date.now() + ms;
  while (Date.now() < end) search.step(500);
  const best = search.best();
  return { score: best.score, placements: [...best.placements] };
}

/** Solves one level and returns the level with its new solution; throws if the engine disagrees. */
export function solveLevel(
  registry: Registry,
  level: LevelJson,
  opts: SolveOptions = {},
): { level: LevelJson; result: SolverResult; changed: boolean } {
  const board = parseLevel(registry, level);
  const hint = opts.hintMs === 0 ? undefined : quickSearch(board, opts.hintMs ?? 1000).placements;
  const result = runSolver(level, opts, hint);

  const solution = solutionFor(registry, level, result);
  // Keep a stored solution for the same inputs unless the new one is better or newly proven.
  const s = solution.score;
  const old = level.solution;
  if (
    old &&
    old.inputs === solution.inputs &&
    (old.score > s || (old.score === s && (old.proven || !result.proven)))
  )
    return { level, result, changed: false };
  return { level: { ...level, solution }, result, changed: true };
}

export async function formatLevel(level: LevelJson, file: string): Promise<string> {
  return formatJson(level, file);
}

/** JSON as the repository's prettier formats it, so written files pass `npm run format:check`. */
export async function formatJson(value: unknown, file: string): Promise<string> {
  const config = (await prettier.resolveConfig(file)) ?? {};
  // Indented input keeps objects expanded as in the hand-written files; prettier collapses short arrays.
  return prettier.format(JSON.stringify(value, null, 2), { ...config, filepath: file });
}

function campaignFiles(): string[] {
  const dir = join(CONTENT_DIR, "levels", "campaign");
  const campaign = CampaignSchema.parse(JSON.parse(readFileSync(join(dir, "campaign.json"), "utf8")));
  return campaign.levels.map((id) => join(dir, `${id}.json`));
}

async function main(argv: string[]): Promise<number> {
  const files: string[] = [];
  const opts: SolveOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a === "--campaign") files.push(...campaignFiles());
    else if (a === "--method") {
      const m = argv[++i];
      if (m !== "model" && m !== "layers") throw new Error("--method is model or layers");
      opts.method = m;
    } else if (a === "--time") opts.time = Number(argv[++i]);
    else if (a === "--workers") opts.workers = Number(argv[++i]);
    else if (a === "--count-optimal") opts.countOptimal = Number(argv[++i]);
    else if (a.startsWith("-")) throw new Error(`unknown option ${a}`);
    else files.push(a);
  }
  if (files.length === 0) {
    console.error(
      "usage: npm run solve -- <level.json …> | --campaign [--time 120] [--workers N] [--method model|layers]",
    );
    return 1;
  }
  const { registry } = loadContent(CONTENT_DIR, { ignoreSolutions: true });
  let failed = 0;
  for (const file of files) {
    const level = LevelSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    try {
      const { level: next, result, changed } = solveLevel(registry, level, opts);
      const how = result.proven ? "proven optimum" : `best found, bound ${result.bound}, not proven`;
      console.log(
        `${level.id}: ${result.score} (${how}, ${result.seconds.toFixed(1)} s)${changed ? "" : " – kept the stored solution"}`,
      );
      if (changed) writeFileSync(file, await formatLevel(next, file));
    } catch (e) {
      failed++;
      console.error(`✗ ${(e as Error).message}`);
    }
  }
  return failed > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith("solve.ts")) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error((e as Error).message);
      process.exit(1);
    },
  );
}
