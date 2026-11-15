"""Solver vs. brute force on random small boards.

The TypeScript engine generates the boards and tries EVERY layout (tools/engine-cli.ts); the solver's
proven optimum must equal that maximum, and the engine must give the solver's layout that score.
`npm run solve:verify` runs it on 300 boards, for the model (model.py) and the layer method
(layers.py).
"""

from __future__ import annotations

import argparse
import json
import sys
import time

from . import engine
from .board import parse_level
from .content import load_content
from .layers import solve_layers
from .model import count_layouts, solve


def crosscheck(count: int, seed: int, workers: int = 1, counts: int = 0, method: str = "model") -> list[str]:
    """Problems found (empty = all agree). `counts`: also check optimal-layout counts on that many boards.
    method "layers" skips boards with negative bonus tiles (the layer method doesn't take them)."""
    levels = engine.call([{"cmd": "random", "seed": seed, "count": count}])[0]
    content = load_content()
    if method == "layers":
        levels = [lv for lv in levels if all(b >= 0 for b in parse_level(content, lv).bonus)]
    brute = engine.call([{"cmd": "brute", "level": lv} for lv in levels])
    run = solve_layers if method == "layers" else solve
    sols = [run(parse_level(content, lv), time_limit=60, workers=workers) for lv in levels]
    rescored = engine.call(
        [
            {"cmd": "score", "level": lv, "placements": s.placements}
            for lv, s in zip(levels, sols, strict=True)
        ]
    )
    problems = []
    for lv, br, sol, re in zip(levels, brute, sols, rescored, strict=True):
        where = f"{method} {lv['id']} {json.dumps(lv['map'])} hedges={lv['pieces']['hedge']}"
        if not sol.proven:
            problems.append(f"{where}: not proven in 60 s")
        if sol.score != br["score"]:
            problems.append(f"{where}: solver {sol.score}, brute force {br['score']} {br['placements']}")
        if counts > 0 and int(lv["id"].rsplit("-", 1)[1]) < counts:
            n, exact = count_layouts(parse_level(content, lv), sol.score, cap=10_000, time_limit=60)
            if not exact or n != br["optimal"]:
                problems.append(f"{where}: solver counts {n} optimal layouts, brute force {br['optimal']}")
        if re["score"] != sol.score or re["steps"] != sol.steps or re["bonus"] != sol.bonus:
            problems.append(f"{where}: engine scores the solver layout {re}, solver says {sol.to_json()}")
    return problems


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="lws.crosscheck", description=__doc__)
    ap.add_argument("--count", type=int, default=300)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--counts", type=int, default=100, help="also check optimal-layout counts on N boards")
    ap.add_argument("--method", choices=("model", "layers", "both"), default="both")
    args = ap.parse_args(argv)
    t0 = time.monotonic()
    methods = ("model", "layers") if args.method == "both" else (args.method,)
    problems = [
        p
        for m in methods
        for p in crosscheck(args.count, args.seed, counts=args.counts if m == "model" else 0, method=m)
    ]
    for p in problems:
        print(p)
    print(
        f"{args.count} random boards × {', '.join(methods)}: {len(problems)} disagreements, "
        f"{time.monotonic() - t0:.0f} s"
    )
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
