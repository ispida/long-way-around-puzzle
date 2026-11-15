"""The layer method finds the same proven optima as the model."""

import pytest
from test_model import KNOWN, level

from lws.board import parse_level
from lws.content import load_content
from lws.layers import solve_layers
from lws.model import Unsupported

CONTENT = load_content()


@pytest.mark.parametrize("name", KNOWN)
def test_known_optimum(name):
    rows, hedges, score, steps, bonus = KNOWN[name]
    sol = solve_layers(parse_level(CONTENT, level(rows, hedges)), time_limit=30, workers=1)
    assert (sol.score, sol.steps, sol.bonus, sol.proven) == (score, steps, bonus, True)
    assert sol.bound == score
    assert len(sol.placements) <= hedges


def test_hint_is_kept_when_nothing_beats_it():
    rows, hedges, score, *_ = KNOWN["open field"]
    board = parse_level(CONTENT, level(rows, hedges))
    best = solve_layers(board, time_limit=30, workers=1)
    again = solve_layers(board, time_limit=30, workers=1, hint=best.placements)
    assert (again.score, again.proven, again.placements) == (score, True, best.placements)


def test_unfinished_run_reports_an_upper_bound():
    rows, hedges, score, *_ = KNOWN["mud"]
    sol = solve_layers(parse_level(CONTENT, level(rows, hedges)), time_limit=0.01, workers=1)
    assert not sol.proven
    assert sol.bound >= score


def test_negative_bonus_is_left_to_the_model():
    board = parse_level(CONTENT, level(["B..H"], 1))
    board.bonus[1] = -3
    with pytest.raises(Unsupported):
        solve_layers(board, time_limit=5, workers=1)


def test_best_layouts_are_reported_as_they_improve():
    rows, hedges, score, *_ = KNOWN["open field"]
    seen: list[int] = []
    sol = solve_layers(
        parse_level(CONTENT, level(rows, hedges)),
        time_limit=30,
        workers=1,
        on_best=lambda p, s: seen.append(s),
    )
    assert seen and seen[-1] == score == sol.score
    assert seen == sorted(seen)
