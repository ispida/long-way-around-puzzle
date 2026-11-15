"""Board facts of the Python model must equal the TypeScript engine's."""

import json

import pytest

from lws import engine
from lws.board import LevelError, parse_level
from lws.content import DEFAULT_CONTENT, load_content

pytestmark = pytest.mark.skipif(not engine.available(), reason="needs node and node_modules (npm ci)")

CONTENT = load_content()
# The real campaign (whatever it holds) and the fixed test levels.
FIXTURES = DEFAULT_CONTENT.parent / "tests" / "fixtures" / "campaign"
CAMPAIGN = sorted((DEFAULT_CONTENT / "levels" / "campaign").glob("lvl*.json")) + sorted(
    FIXTURES.glob("lvl*.json")
)


@pytest.fixture(scope="module")
def random_levels():
    return engine.call([{"cmd": "random", "seed": 4, "count": 100}])[0]


def test_campaign_board_facts_match_engine():
    levels = [json.loads(f.read_text(encoding="utf-8")) for f in CAMPAIGN]
    assert len(levels) >= 9  # at least one campaign level plus the 8 test levels
    ts = engine.call([{"cmd": "board", "level": lv} for lv in levels])
    for lv, facts in zip(levels, ts, strict=True):
        assert parse_level(CONTENT, lv).facts() == facts, lv["id"]


def test_random_board_facts_match_engine(random_levels):
    ts = engine.call([{"cmd": "board", "level": lv} for lv in random_levels])
    kinds = set()
    for lv, facts in zip(random_levels, ts, strict=True):
        assert parse_level(CONTENT, lv).facts() == facts, lv["map"]
        kinds |= set("".join(lv["map"]))
    # The generator really covers every tile type.
    assert kinds >= set(".TmQ~<>^vBH1")


def test_unpaired_tunnel_is_an_error():
    with pytest.raises(LevelError, match="exactly 2 cells"):
        parse_level(CONTENT, {"map": ["B.1.H"], "pieces": {"hedge": 1}})
