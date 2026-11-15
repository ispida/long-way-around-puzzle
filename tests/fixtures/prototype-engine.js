// @ts-nocheck
/* eslint-disable */
/**
 * VERBATIM copy of the prototype engine. Used only as a test oracle for differential parity tests
 *. Do not edit the copied code.
 */
/* ---------- engine ---------- */
function parse(map) {
  const h = map.length, w = map[0].length, n = w * h;
  const tiles = [], honey = [], partner = new Int32Array(n).fill(-1);
  const holes = {}; let bear = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = map[y][x], i = y * w + x; tiles.push(c);
    if (c === "B") bear = i;
    if (c === "H") honey.push(i);
    if (/[1-9]/.test(c)) (holes[c] = holes[c] || []).push(i);
  }
  for (const k in holes) { const [a, b] = holes[k]; if (b !== undefined) { partner[a] = b; partner[b] = a; } }
  return { w, h, n, tiles, bear, honey, partner, map };
}
// 4-neighbours as [index, direction char]
function nbrs(i, w, h) {
  const x = i % w, y = (i / w) | 0, r = [];
  if (x > 0) r.push([i - 1, "<"]); if (x < w - 1) r.push([i + 1, ">"]);
  if (y > 0) r.push([i - w, "^"]); if (y < h - 1) r.push([i + w, "v"]);
  return r;
}
const SLOPES = "<>^v";
const HIVE_BONUS = 5;
const cost = t => (t === "m" ? 3 : 1);
function walkable(L, i, hedge) {
  const t = L.tiles[i];
  return !(t === "T" || t === "~" || hedge[i]);
}
// A move in direction d from i to j is allowed only if neither end is a slope pointing elsewhere.
function canMove(L, i, j, d) {
  const a = L.tiles[i], b = L.tiles[j];
  return !(SLOPES.includes(a) && a !== d) && !(SLOPES.includes(b) && b !== d);
}
function canHedge(L, i) { return L.tiles[i] === "."; }

// Dijkstra from the animal to the nearest food.
// Priority = steps * K + hives: the animal minimises steps first and, among equally short routes, avoids hives.
// Returns {steps, hives, dist (= score = steps + 5*hives), path:[{i, tunnel}], open}. Cut off => dist 0.
const K = 1000;
function route(L, hedge) {
  const dist = new Float64Array(L.n).fill(Infinity), prev = new Int32Array(L.n).fill(-1), viaTunnel = new Uint8Array(L.n);
  const heap = [[0, L.bear]]; dist[L.bear] = 0;
  const isFood = new Uint8Array(L.n); for (const f of L.honey) isFood[f] = 1;
  const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const [d, i] = pop(); if (d > dist[i]) continue;
    if (isFood[i]) {
      const path = []; for (let c = i; c !== -1; c = prev[c]) path.push({ i: c, tunnel: !!viaTunnel[c] });
      const steps = Math.floor(d / K), hives = d % K;
      return { steps, hives, dist: steps + HIVE_BONUS * hives, path: path.reverse(), open: true };
    }
    const step = (j, c, t) => { const nd = d + c; if (nd < dist[j]) { dist[j] = nd; prev[j] = i; viaTunnel[j] = t ? 1 : 0; push(nd, j); } };
    for (const [j, dir] of nbrs(i, L.w, L.h)) if (walkable(L, j, hedge) && canMove(L, i, j, dir)) step(j, cost(L.tiles[j]) * K + (L.tiles[j] === "Q" ? 1 : 0), false);
    const p = L.partner[i]; if (p >= 0 && !hedge[p]) step(p, K, true);
  }
  return { steps: 0, hives: 0, dist: 0, path: [], open: false };
}

export { parse, route, canHedge, HIVE_BONUS };
