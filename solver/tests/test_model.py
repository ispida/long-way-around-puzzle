"""CP-SAT model on hand-made boards with known optima.

Every expected score was confirmed by trying every layout in the TypeScript engine (engine-cli
`brute`); test_crosscheck.py does the same for hundreds of random boards.
"""

import json

import pytest

from lws import engine
from lws.board import parse_level
from lws.cli import main
from lws.content import DEFAULT_CONTENT, load_content
from lws.model import Unsupported, count_layouts, solve

CONTENT = load_content()


def level(rows: list[str], hedges: int) -> dict:
    return {
        "schema": 1,
        "id": "t",
        "name": "t",
        "tag": "t",
        "text": "",
        "map": rows,
        "pieces": {"hedge": hedges},
    }


# name: (map, hedges, score, steps, bonus)
KNOWN = {
    # Every grass cell is on the only route: any hedge traps the animal, so place none.
    "corridor": (["B...H"], 1, 4, 4, 0),
    "open field": (["B....H", "......"], 1, 7, 7, 0),
    "mud": (["B.mm.H", "......"], 2, 11, 11, 0),
    # The burrow can't be blocked: 1 step in, 1 through, 1 to the food.
    "tunnel": (["1..T...", "B..T..H", "...T..1"], 2, 3, 3, 0),
    "forced hive": (["...Q...", "B.....H", "......."], 2, 13, 8, 5),
    # §A1: the longest route (6 steps) is worse than a 4-step route through the hive (4 + 5).
    "steps first loses": (["m...", "T<H.", "m.Qm", "..^.", "...B"], 1, 9, 4, 5),
    # The slope points the wrong way: the animal goes around it.
    "one-way": ([".....", "B.<.H", "....."], 2, 6, 6, 0),
    # Lengthening the way to one stash only helps until the other one is nearer.
    "two goals": (["H......", "...B...", "......H"], 2, 4, 4, 0),
}


@pytest.mark.parametrize("name", KNOWN)
def test_known_optimum(name):
    rows, hedges, score, steps, bonus = KNOWN[name]
    sol = solve(parse_level(CONTENT, level(rows, hedges)), time_limit=30, workers=1)
    assert (sol.score, sol.steps, sol.bonus, sol.proven) == (score, steps, bonus, True)
    assert sol.bound == score
    assert len(sol.placements) <= hedges


@pytest.mark.skipif(not engine.available(), reason="needs node and node_modules (npm ci)")
def test_engine_agrees_with_solver_layouts():
    levels = [level(rows, hedges) for rows, hedges, *_ in KNOWN.values()]
    sols = [solve(parse_level(CONTENT, lv), time_limit=30, workers=1) for lv in levels]
    reqs = [
        {"cmd": "score", "level": lv, "placements": s.placements} for lv, s in zip(levels, sols, strict=True)
    ]
    for sol, got in zip(sols, engine.call(reqs), strict=True):
        assert got == {"open": True, "steps": sol.steps, "bonus": sol.bonus, "score": sol.score}


def test_lvl01_matches_handoff_best():
    lv = json.loads(
        (DEFAULT_CONTENT.parent / "tests" / "fixtures" / "campaign" / "lvl01.json").read_text(
            encoding="utf-8"
        )
    )
    sol = solve(parse_level(CONTENT, lv), time_limit=60)
    assert (sol.score, sol.proven) == (14, True)


def test_count_layouts():
    board = parse_level(CONTENT, level(["B...H"], 1))
    assert count_layouts(board, 4, cap=50) == (1, True)  # only the empty layout keeps the path open
    board = parse_level(CONTENT, level(["B....H", "......"], 1))
    n, exact = count_layouts(board, 7, cap=50)
    assert exact and n >= 1
    assert count_layouts(board, 7, cap=1) == (1, False)


def test_unsupported_effect_is_refused():
    content = load_content()  # a fresh copy, safe to extend
    content.pieces["puddle"] = {"id": "puddle", "effect": {"type": "setCost", "cost": 3}}
    content.tiles["grass"]["accepts"] = ["hedge", "puddle"]
    board = parse_level(content, {**level(["B..H"], 1), "pieces": {"puddle": 1}})
    with pytest.raises(Unsupported, match="setCost"):
        solve(board, time_limit=5)


def test_cli_solve(tmp_path, capsys):
    f = tmp_path / "level.json"
    f.write_text(json.dumps(level(["B....H", "......"], 1)))
    assert main(["solve", str(f), "--time", "10", "--workers", "1", "--count-optimal", "10"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["score"] == 7 and out["proven"] is True and out["optimalLayouts"] >= 1


def test_cli_count(tmp_path, capsys):
    f = tmp_path / "level.json"
    f.write_text(json.dumps(level(["B...H"], 1)))
    assert main(["count", str(f), "--score", "4", "--cap", "10"]) == 0
    assert json.loads(capsys.readouterr().out) == {"layouts": 1, "exact": True}


def test_cli_solve_with_inline_hint(tmp_path, capsys):
    f = tmp_path / "level.json"
    f.write_text(json.dumps(level(["B....H", "......"], 1)))
    assert main(["solve", str(f), "--time", "10", "--workers", "1", "--hint-json", '[[2, "hedge"]]']) == 0
    assert json.loads(capsys.readouterr().out)["score"] == 7
