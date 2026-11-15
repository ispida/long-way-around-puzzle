/** `npm run bench`: route speed and search throughput. Target: route < 1 ms on 20×20. */
import { createRng, createSearch, parseLevel, route, type Board } from "@engine/index";
import { LevelSchema } from "@shared/schemas";
import { loadContent } from "./content-io";

const { registry, fixtures: levels } = loadContent();

/** A 20×20 board with trees, mud, two tunnels and hives, start and goal in opposite corners. */
function synthetic(): Board {
  const rng = createRng(42);
  const rows: string[][] = Array.from({ length: 20 }, () =>
    Array.from({ length: 20 }, () => {
      const r = rng();
      return r < 0.12 ? "T" : r < 0.2 ? "m" : r < 0.22 ? "Q" : ".";
    }),
  );
  const set = (x: number, y: number, c: string) => ((rows[y] as string[])[x] = c);
  // Keep both corners open so the start is never sealed in.
  for (const [x, y] of [
    [1, 0],
    [0, 1],
    [1, 1],
    [18, 19],
    [19, 18],
    [18, 18],
  ] as const)
    set(x, y, ".");
  set(0, 0, "B");
  set(19, 19, "H");
  set(3, 15, "1");
  set(16, 4, "1");
  set(10, 2, "2");
  set(9, 17, "2");
  const level = LevelSchema.parse({
    schema: 1,
    id: "bench",
    name: "Bench",
    tag: "Bench",
    text: "",
    map: rows.map((r) => r.join("")),
    pieces: { hedge: 20 },
  });
  const b = parseLevel(registry, level);
  if (!route(b).open) throw new Error("synthetic bench board is cut off");
  return b;
}

function timeRoute(name: string, b: Board, runs = 5000) {
  const rng = createRng(1);
  const layouts = Array.from({ length: 64 }, () => {
    const m = new Map<number, string>();
    for (let i = 0; i < 10; i++) {
      const c = Math.floor(rng() * b.n);
      if (b.placeable[0]?.[c]) m.set(c, "hedge");
    }
    return m;
  });
  for (let i = 0; i < 500; i++) route(b, layouts[i % 64]); // warm-up
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) route(b, layouts[i % 64]);
  const us = ((performance.now() - t0) / runs) * 1000;
  console.log(
    `route  ${name.padEnd(22)} ${b.w}×${b.h}  ${us.toFixed(1).padStart(7)} µs/call  ${us < 1000 ? "OK" : "SLOW"}`,
  );
}

function timeSearch(name: string, b: Board, iterations = 20_000) {
  const s = createSearch(b, { seed: 1 });
  const t0 = performance.now();
  s.step(iterations);
  const ms = performance.now() - t0;
  console.log(
    `search ${name.padEnd(22)} ${Math.round(iterations / (ms / 1000)).toLocaleString("en")} iterations/s  best ${s.best().score}`,
  );
}

const big = levels.find((l) => l.id === "lvl08");
if (big) timeRoute("lvl08 Sample daily", parseLevel(registry, big));
const syn = synthetic();
timeRoute("synthetic", syn);
if (big) timeSearch("lvl08 Sample daily", parseLevel(registry, big));
timeSearch("synthetic", syn);
