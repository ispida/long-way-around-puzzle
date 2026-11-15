"""Exact solver: CP-SAT model of the best hedge layout.

The animal saves as little as it can: it minimises
[steps + bonus, bonus] lexicographically. With edge weights w = K·(steps + bonus) + bonus and K larger
than the spread of all bonus points, that order is the order of the weights, and two routes of equal
weight have equal steps and bonus.

The model is the classic interdiction form (strong duality of shortest paths):
  * potentials d_v with d_goal = 0 and d_v <= d_u + w on every open edge v→u, so d_start is at most
    the true shortest distance;
  * the animal's route as a 0/1 path from the start to a goal over open edges, whose weight is at
    least the true shortest distance;
  * weight(route) <= d_start, which forces the route to be a shortest route (and, as all weights are
    positive, rules out detached cycles).
The objective is steps + bonus summed along that route, i.e. the score the engine would give.
"""

from __future__ import annotations

import heapq
import os
import time
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .board import Board
from .grid import DIRS, step


class Unsupported(ValueError):
    """The level uses something the model can't encode (yet); use the heuristic search instead."""


@dataclass(frozen=True)
class Edge:
    src: int
    dst: int
    steps: int
    bonus: int


def edges(board: Board) -> list[Edge]:
    """Every move the animal could make on the empty board, exactly as route.ts relaxes them."""
    out: list[Edge] = []
    w, h = board.w, board.h
    for i in range(board.n):
        if not board.walkable[i]:
            continue
        oi = board.one_way[i]
        for d in DIRS:
            j = step(i, d, w, h)
            if j < 0 or not board.walkable[j]:
                continue
            if oi not in (0, d) or board.one_way[j] not in (0, d):
                continue
            out.append(Edge(i, j, board.cost[j], board.bonus[j]))
        p = board.partner[i]
        if p >= 0 and board.walkable[p]:
            out.append(Edge(i, p, board.tunnel_cost[i], board.bonus[p]))
    return out


def default_workers() -> int:
    return max(1, min(8, os.cpu_count() or 1))


@dataclass
class Solution:
    score: int
    steps: int
    bonus: int
    placements: list[tuple[int, str]]
    proven: bool
    bound: int
    seconds: float
    optimal_layouts: int | None = None
    optimal_layouts_exact: bool = False

    def to_json(self) -> dict:
        out = {
            "score": self.score,
            "steps": self.steps,
            "bonus": self.bonus,
            "placements": [list(p) for p in self.placements],
            "proven": self.proven,
            "bound": self.bound,
            "seconds": round(self.seconds, 3),
        }
        if self.optimal_layouts is not None:
            out["optimalLayouts"] = self.optimal_layouts
            out["optimalLayoutsExact"] = self.optimal_layouts_exact
        return out


def weight(e: Edge, k: int) -> int:
    """The animal's order on moves as one number: what the move counts first, then its bonus."""
    return k * (e.steps + e.bonus) + e.bonus


class _Model:
    def __init__(self, board: Board):
        if board.ruleset.get("onCutOff") != "zero":
            raise Unsupported(f'rule set onCutOff "{board.ruleset.get("onCutOff")}"')
        for p, eff in board.effects.items():
            if eff["type"] != "block":
                raise Unsupported(f'piece "{p}" has effect "{eff["type"]}"')
        es = edges(board)
        if any(e.steps + e.bonus <= 0 for e in es):
            raise Unsupported("a move that counts 0 or less")

        pos = sum(b for b in board.bonus if b > 0)
        neg = sum(b for b in board.bonus if b < 0)
        k = pos - neg + 1
        walk_cost = sum(c for c, wk in zip(board.cost, board.walkable, strict=True) if wk)
        big = k * (walk_cost + sum(board.tunnel_cost) + pos) + pos + 1  # above any route's weight
        goals = set(board.goals)

        m = cp_model.CpModel()
        self.m = m
        # x[(cell, piece)]: a piece on the cell; at most one piece per cell, budgets per piece.
        self.x: dict[tuple[int, str], cp_model.IntVar] = {}
        per_cell: dict[int, list[cp_model.IntVar]] = {}
        for p, budget in zip(board.piece_ids, board.budgets, strict=True):
            vs = []
            for c in board.placeable[p]:
                v = m.new_bool_var(f"x{c}_{p}")
                self.x[(c, p)] = v
                per_cell.setdefault(c, []).append(v)
                vs.append(v)
            m.add(sum(vs) <= budget)
        blocked: dict[int, cp_model.IntVar] = {}
        for c, vs in per_cell.items():
            if len(vs) == 1:
                blocked[c] = vs[0]
            else:
                b = m.new_bool_var(f"b{c}")
                m.add(b == sum(vs))
                blocked[c] = b

        # Pieces only make routes longer, so the empty board's distances are lower bounds.
        low = _empty_distances(board, es, k)
        d: dict[int, cp_model.IntVar] = {}
        for i in range(board.n):
            if board.walkable[i]:
                d[i] = m.new_constant(0) if i in goals else m.new_int_var(min(low[i], big), big, f"d{i}")

        route: list[tuple[Edge, cp_model.IntVar]] = []
        out_of: dict[int, list[cp_model.IntVar]] = {}
        into: dict[int, list[cp_model.IntVar]] = {}
        for e in es:
            if e.src in goals or e.dst == board.start:
                continue  # the walk ends at the first goal and never returns to the start
            w = weight(e, k)
            y = m.new_bool_var(f"y{e.src}_{e.dst}")
            route.append((e, y))
            out_of.setdefault(e.src, []).append(y)
            into.setdefault(e.dst, []).append(y)
            ends = [blocked[c] for c in (e.src, e.dst) if c in blocked]
            if not ends:
                m.add(d[e.src] <= d[e.dst] + w)
                continue
            is_open = m.new_bool_var(f"o{e.src}_{e.dst}")
            m.add_bool_and([b.Not() for b in ends]).only_enforce_if(is_open)
            m.add_bool_or(ends).only_enforce_if(is_open.Not())
            m.add(d[e.src] <= d[e.dst] + w).only_enforce_if(is_open)
            m.add_implication(y, is_open)

        for i in d:
            outs, ins = out_of.get(i, []), into.get(i, [])
            if i == board.start:
                m.add(sum(outs) == 1)
            elif i not in goals:
                m.add(sum(outs) == sum(ins))
                m.add(sum(ins) <= 1)
        m.add(sum(y for g in goals for y in into.get(g, [])) == 1)
        m.add(sum(weight(e, k) * y for e, y in route) <= d[board.start])

        self.steps = sum(e.steps * y for e, y in route)
        self.bonus = sum(e.bonus * y for e, y in route)
        self.objective = self.steps + self.bonus

    def placements(self, solver: cp_model.CpSolver) -> list[tuple[int, str]]:
        return sorted((c, p) for (c, p), v in self.x.items() if solver.value(v))

    def hint(self, placements: list[tuple[int, str]]) -> None:
        chosen = set(placements)
        for key, v in self.x.items():
            self.m.add_hint(v, key in chosen)


def _empty_distances(board: Board, es: list[Edge], k: int) -> list[int]:
    """Weight of every cell's best route to the nearest goal with no pieces placed (reverse Dijkstra)."""
    inf = 1 << 60
    rev: dict[int, list[tuple[int, int]]] = {}
    for e in es:
        rev.setdefault(e.dst, []).append((e.src, weight(e, k)))
    dist = [inf] * board.n
    heap = [(0, g) for g in board.goals]
    for g in board.goals:
        dist[g] = 0
    while heap:
        dv, v = heapq.heappop(heap)
        if dv > dist[v]:
            continue
        for u, w in rev.get(v, []):
            if u not in board.goals and dv + w < dist[u]:
                dist[u] = dv + w
                heapq.heappush(heap, (dist[u], u))
    return dist


def solve(
    board: Board,
    time_limit: float = 120.0,
    workers: int | None = None,
    count_optimal: int = 0,
    hint: list[tuple[int, str]] | None = None,
) -> Solution:
    """Best layout within the time limit; `proven` tells whether it is the optimum."""
    t0 = time.monotonic()
    mod = _Model(board)
    if hint:
        mod.hint(hint)
    mod.m.maximize(mod.objective)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.num_workers = workers or default_workers()
    status = solver.solve(mod.m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise RuntimeError(f"no layout found: {solver.status_name(status)}")
    sol = Solution(
        score=round(solver.objective_value),
        steps=int(solver.value(mod.steps)),
        bonus=int(solver.value(mod.bonus)),
        placements=mod.placements(solver),
        proven=status == cp_model.OPTIMAL,
        bound=int(solver.best_objective_bound),
        seconds=0.0,
    )
    if count_optimal > 0 and sol.proven:
        left = max(1.0, time_limit - (time.monotonic() - t0))
        sol.optimal_layouts, sol.optimal_layouts_exact = count_layouts(board, sol.score, count_optimal, left)
    sol.seconds = time.monotonic() - t0
    return sol


def count_layouts(board: Board, score: int, cap: int, time_limit: float = 60.0) -> tuple[int, bool]:
    """How many layouts reach `score`, and whether that is the exact number (False: at least that many,
    because the cap or the time limit was hit). Layouts with spare pieces count separately.

    Counts by repeated solving with a no-good cut on the piece variables after each layout found
    (solution enumeration would also step through the many equivalent potentials d)."""
    end = time.monotonic() + time_limit
    mod = _Model(board)
    mod.m.add(mod.objective == score)
    xs = list(mod.x.values())
    found = 0
    while found < cap:
        left = end - time.monotonic()
        if left <= 0:
            return found, False
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = left
        solver.parameters.num_workers = default_workers()
        status = solver.solve(mod.m)
        if status == cp_model.INFEASIBLE:
            return found, True
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return found, False
        found += 1
        mod.m.add_bool_or([v.Not() if solver.value(v) else v for v in xs])
    return found, False
