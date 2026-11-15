"""Exact solver by step layers, for boards the all-at-once model (model.py)
can't prove.

Instead of optimising directly it answers yes/no questions, "is there a layout whose route scores at
least L?", for L = best known + 1, + 2, … until the answer is no; the last yes is the optimum.

Every move counts its steps plus the bonus of the cell it enters (a hive: 1 + 5), and the animal takes
the route that counts least, so its score is simply the shortest distance
with these counts. Each question is a pure boolean model that SAT-style search handles well:

  * reach[v][t]: the animal can be on cell v with a count of t or less. It starts true at the start;
    every move v→u counting c forces reach[u][t+c] unless u is blocked. The food must not be reachable
    below L. (reach may be set true more often than needed; that only makes the question harder, never
    wrongly easy.)
  * a 0/1 path from the start to a food over open cells, so the animal is never trapped (a trapped
    animal scores 0, and the game refuses such layouts).

Cells farther than t on the empty board can't be reached with count t with pieces either, and from a
cell whose empty-board distance to the food would end at or after L no food can be reached below L;
both kinds of variables are left out (the second keeps the model small on large boards).
"""

from __future__ import annotations

import heapq
import time
from collections.abc import Callable
from dataclasses import dataclass

from ortools.sat.python import cp_model

from .board import Board
from .model import Solution, Unsupported, default_workers, edges


@dataclass(frozen=True)
class Walk:
    """The animal's route for one layout: None if it is cut off."""

    weight: int
    steps: int
    bonus: int
    cells: tuple[int, ...]  # route cells after the start, goal included


class Graph:
    def __init__(self, board: Board):
        if board.ruleset.get("onCutOff") != "zero":
            raise Unsupported(f'rule set onCutOff "{board.ruleset.get("onCutOff")}"')
        for p, eff in board.effects.items():
            if eff["type"] != "block":
                raise Unsupported(f'piece "{p}" has effect "{eff["type"]}"')
        es = edges(board)
        if any(e.steps + e.bonus <= 0 for e in es):
            raise Unsupported("a move that counts 0 or less")
        self.board = board
        pos = sum(b for b in board.bonus if b > 0)
        neg = sum(b for b in board.bonus if b < 0)
        self.k = pos - neg + 1
        self.pos, self.neg = pos, neg
        self.goals = set(board.goals)
        self.out: dict[int, list[tuple[int, int, int]]] = {}
        for e in es:
            if e.src in self.goals or e.dst == board.start:
                continue
            self.out.setdefault(e.src, []).append((e.dst, e.steps, e.bonus))

    def walk(self, blocked: set[int]) -> Walk | None:
        """Lightest route from the start to the nearest goal with `blocked` cells closed."""
        k = self.k
        start = self.board.start
        dist = {start: 0}
        prev: dict[int, tuple[int, int, int]] = {}
        heap = [(0, start)]
        while heap:
            dv, v = heapq.heappop(heap)
            if dv > dist.get(v, 1 << 62):
                continue
            if v in self.goals:
                cells: list[int] = []
                steps = bonus = 0
                u = v
                while u != start:
                    p, s, b = prev[u]
                    cells.append(u)
                    steps += s
                    bonus += b
                    u = p
                return Walk(dv, steps, bonus, tuple(reversed(cells)))
            for u, s, b in self.out.get(v, ()):
                if u in blocked:
                    continue
                nd = dv + k * (s + b) + b
                if nd < dist.get(u, 1 << 62):
                    dist[u] = nd
                    prev[u] = (v, s, b)
                    heapq.heappush(heap, (nd, u))
        return None


def _empty_counts(board: Board, out: dict[int, list[tuple[int, int, int]]]) -> dict[int, int]:
    """Least count (steps + bonus) from the start to every cell on the empty board."""
    dist = {board.start: 0}
    heap = [(0, board.start)]
    while heap:
        dv, v = heapq.heappop(heap)
        if dv > dist[v]:
            continue
        for u, s, b in out.get(v, ()):
            if dv + s + b < dist.get(u, 1 << 62):
                dist[u] = dv + s + b
                heapq.heappush(heap, (dv + s + b, u))
    return dist


def _counts_to_food(g: Graph) -> dict[int, int]:
    """Least count from every cell to the nearest food on the empty board (pieces only add to it)."""
    back: dict[int, list[tuple[int, int]]] = {}
    for v, outs in g.out.items():
        for u, s, b in outs:
            back.setdefault(u, []).append((v, s + b))
    dist = {gl: 0 for gl in g.goals}
    heap = [(0, gl) for gl in g.goals]
    while heap:
        du, u = heapq.heappop(heap)
        if du > dist[u]:
            continue
        for v, s in back.get(u, ()):
            if du + s < dist.get(v, 1 << 62):
                dist[v] = du + s
                heapq.heappush(heap, (du + s, v))
    return dist


class _Question:
    """The yes/no model for "is there a layout whose route counts (scores) at least `target`?"."""

    def __init__(self, board: Board, g: Graph, target: int):
        m = cp_model.CpModel()
        self.m = m
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
                bv = m.new_bool_var(f"b{c}")
                m.add(bv == sum(vs))
                blocked[c] = bv
        self.blocked = blocked

        near = _empty_counts(board, g.out)
        left = _counts_to_food(g)
        reach: dict[tuple[int, int], cp_model.IntVar] = {}
        at_count: dict[int, list[int]] = {}

        def r(v: int, t: int) -> cp_model.IntVar | None:
            if near.get(v, 1 << 62) > t:
                return None  # can't be there that early, whatever the pieces
            if t + left.get(v, 1 << 62) >= target:
                # From here no food can be reached below the target, whatever the pieces, so the
                # state can't matter. (A kept state's predecessors are kept too: left[v] <= c + left[u].)
                return None
            key = (v, t)
            if key not in reach:
                start = v == board.start and t == 0
                reach[key] = m.new_constant(1) if start else m.new_bool_var(f"r{v}_{t}")
                at_count.setdefault(t, []).append(v)
            return reach[key]

        r(board.start, 0)
        for t in range(target):
            for v in at_count.get(t, []):
                if v in g.goals:
                    continue  # the walk ends at the first food
                rv = reach[(v, t)]
                for u, s, b in g.out.get(v, ()):
                    c = s + b
                    if t + c >= target:
                        continue
                    ru = r(u, t + c)
                    if ru is None:  # pragma: no cover - near[u] <= near[v] + c <= t + c
                        continue
                    lits = [rv.Not(), ru]
                    if u in blocked:
                        lits.append(blocked[u])
                    m.add_bool_or(lits)

        for (v, t), var in reach.items():
            if v in g.goals and t < target:
                m.add(var == 0)

        # Some food stays reachable: a path of open cells from the start.
        out_of: dict[int, list[cp_model.IntVar]] = {}
        into: dict[int, list[cp_model.IntVar]] = {}
        for e in edges(board):
            if e.src in g.goals or e.dst == board.start:
                continue
            y = m.new_bool_var(f"y{e.src}_{e.dst}")
            out_of.setdefault(e.src, []).append(y)
            into.setdefault(e.dst, []).append(y)
            for c in (e.src, e.dst):
                if c in blocked:
                    m.add_implication(y, blocked[c].Not())
        cells = {board.start, *out_of, *into}
        for i in cells:
            outs, ins = out_of.get(i, []), into.get(i, [])
            if i == board.start:
                m.add(sum(outs) == 1)
            elif i not in g.goals:
                m.add(sum(outs) == sum(ins))
                m.add(sum(ins) <= 1)
        m.add(sum(y for gl in g.goals for y in into.get(gl, [])) == 1)

    def hint(self, cells: set[int]) -> None:
        for (c, _p), v in self.x.items():
            self.m.add_hint(v, c in cells)


def solve_layers(
    board: Board,
    time_limit: float = 120.0,
    workers: int | None = None,
    hint: list[tuple[int, str]] | None = None,
    log: Callable[[str], None] | None = None,
    on_best: Callable[[list[tuple[int, str]], int], None] | None = None,
) -> Solution:
    """`on_best(placements, score)` is called on every improvement, so a long run interrupted by a
    restart can resume from its best layout (cli --save-best, then --hint)."""
    t0 = time.monotonic()
    end = t0 + time_limit
    g = Graph(board)
    empty = g.walk(set())
    if empty is None:
        raise RuntimeError("the start is cut off on the empty board")

    def score(cells: set[int]) -> int:
        w = g.walk(cells)
        return -1 if w is None else w.steps + w.bonus

    best_cells: set[int] = set()
    best = score(set())
    if hint:
        hc = {c for c, _ in hint}
        if score(hc) > best:
            best, best_cells = score(hc), hc

    proven = False
    while True:
        left = end - time.monotonic()
        if left <= 0.05:
            break
        q = _Question(board, g, best + 1)
        q.hint(best_cells)
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = left
        solver.parameters.num_workers = workers or default_workers()
        status = solver.solve(q.m)
        if status == cp_model.INFEASIBLE:
            proven = True
            break
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break  # out of time on this question
        cells = {c for c, v in q.blocked.items() if solver.value(v)}
        got = score(cells)
        if got <= best:  # pragma: no cover - the model rules this out
            raise RuntimeError(f"layer model answered yes for {best + 1} but the walk gives {got}")
        best, best_cells = got, cells
        if log:
            log(f"{time.monotonic() - t0:.1f} s: {best}")
        if on_best:
            on_best(_placements(board, best_cells), best)

    placements = _placements(board, best_cells)
    final = g.walk(set(best_cells))
    assert final is not None
    return Solution(
        score=final.steps + final.bonus,
        steps=final.steps,
        bonus=final.bonus,
        placements=placements,
        proven=proven,
        bound=best if proven else _upper(board),
        seconds=time.monotonic() - t0,
    )


def _placements(board: Board, cells: set[int]) -> list[tuple[int, str]]:
    """Blocked cells as [cell, piece] pairs within the budgets."""
    out: list[tuple[int, str]] = []
    left = dict(zip(board.piece_ids, board.budgets, strict=True))
    for c in sorted(cells):
        for p in board.piece_ids:
            if left[p] > 0 and c in board.placeable[p]:
                out.append((c, p))
                left[p] -= 1
                break
    return out


def _upper(board: Board) -> int:
    """A trivial upper bound for an unfinished run: every walkable cost once."""
    return sum(c for c, wk in zip(board.cost, board.walkable, strict=True) if wk) + sum(board.tunnel_cost)
