"""Command line.

  python -m lws.cli --check-content
  python -m lws.cli solve LEVEL.json [--time 120] [--workers N] [--count-optimal 50]
                          [--hint LAYOUT.json | --hint-json '[[cell, piece], …]'] [--method model|layers]
  python -m lws.cli count LEVEL.json --score N [--cap 50] [--time 60]

`solve` prints one JSON object: score, steps, bonus, placements [[cell, piece], …], proven, bound
(the best proven upper bound on the score), seconds and, with --count-optimal, optimalLayouts(Exact).
`count` prints {"layouts": n, "exact": bool}: how many layouts reach the score (spare pieces count
separately); exact is false if the cap or the time limit stopped the count.
Exit code 2 if the level uses something the model can't encode.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .behaviors import ENCODERS
from .board import parse_level
from .content import DEFAULT_CONTENT, load_content
from .layers import solve_layers
from .model import Unsupported, count_layouts, solve


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="lws", description="Long Way Around exact solver")
    parser.add_argument("--version", action="store_true", help="print the solver version")
    parser.add_argument("--check-content", action="store_true", help="load content/ and print a summary")
    parser.add_argument("--content", type=Path, default=DEFAULT_CONTENT, help="path to the content folder")
    sub = parser.add_subparsers(dest="command")
    sp = sub.add_parser("solve", help="find the best layout of a level")
    sp.add_argument("level", type=Path, help="level JSON file ('-' for stdin)")
    sp.add_argument("--time", type=float, default=120.0, help="time limit in seconds (default 120)")
    sp.add_argument("--workers", type=int, default=None, help="CP-SAT workers (default: cores, max 8)")
    sp.add_argument("--count-optimal", type=int, default=0, metavar="CAP", help="count optimal layouts")
    sp.add_argument("--hint", type=Path, help="JSON [[cell, piece], …] to start from, e.g. the search's best")
    sp.add_argument("--hint-json", help="the same hint given inline")
    sp.add_argument(
        "--method",
        choices=("model", "layers"),
        default="model",
        help="model: all-at-once CP-SAT model; layers: yes/no questions on step layers, for large boards",
    )
    sp.add_argument("--verbose", action="store_true", help="progress on stderr (layers)")
    sp.add_argument(
        "--save-best",
        type=Path,
        help="layers: write the best layout so far to this file ([[cell, piece], …]) on every"
        " improvement, to resume an interrupted run with --hint",
    )
    cp = sub.add_parser("count", help="count the layouts that reach a score")
    cp.add_argument("level", type=Path, help="level JSON file ('-' for stdin)")
    cp.add_argument("--score", type=int, required=True)
    cp.add_argument("--cap", type=int, default=50)
    cp.add_argument("--time", type=float, default=60.0)
    args = parser.parse_args(argv)

    if args.version:
        print(__version__)
        return 0
    if args.check_content:
        c = load_content(args.content)
        missing = sorted(c.behavior_types() - ENCODERS.keys())
        print(
            json.dumps(
                {
                    "tiles": sorted(c.tiles),
                    "pieces": sorted(c.pieces),
                    "rulesets": sorted(c.rulesets),
                    "behaviorsWithoutEncoder": missing,
                },
                indent=2,
            )
        )
        return 0
    if args.command not in ("solve", "count"):
        parser.print_help()
        return 1
    text = sys.stdin.read() if str(args.level) == "-" else args.level.read_text(encoding="utf-8")
    board = parse_level(load_content(args.content), json.loads(text))
    try:
        if args.command == "count":
            n, exact = count_layouts(board, args.score, args.cap, args.time)
            print(json.dumps({"layouts": n, "exact": exact}))
            return 0
        hint = None
        raw = args.hint.read_text(encoding="utf-8") if args.hint else args.hint_json
        if raw:
            hint = [(int(c), str(p)) for c, p in json.loads(raw)]
        if args.method == "layers":
            log = (lambda m: print(m, file=sys.stderr, flush=True)) if args.verbose else None
            save = None
            if args.save_best:
                path = args.save_best

                def save(placements: list[tuple[int, str]], _score: int) -> None:
                    tmp = path.with_suffix(".tmp")
                    tmp.write_text(json.dumps([list(p) for p in placements]), encoding="utf-8")
                    tmp.replace(path)

            sol = solve_layers(board, args.time, args.workers, hint, log, save)
            if args.count_optimal and sol.proven:
                sol.optimal_layouts, sol.optimal_layouts_exact = count_layouts(
                    board, sol.score, args.count_optimal, max(1.0, args.time - sol.seconds)
                )
        else:
            sol = solve(board, args.time, args.workers, args.count_optimal, hint)
    except Unsupported as e:
        print(f"unsupported: {e}", file=sys.stderr)
        return 2
    print(json.dumps(sol.to_json()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
