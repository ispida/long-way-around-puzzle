import json

import pytest

from lws.cli import main
from lws.content import load_content


def test_loads_shipped_content():
    c = load_content()
    assert "grass" in c.tiles and "hive" in c.tiles
    assert list(c.pieces) == ["hedge"]
    assert "default" in c.rulesets


def test_char_map_matches_typescript_view():
    # Same uniqueness rule as tools/content-check.ts: one tile per map character.
    chars = load_content().char_map()
    assert chars["."] == "grass"
    assert chars["B"] == "start"
    assert chars["1"] == chars["9"] == "burrow"
    assert chars[">"] == "slope-right"


def test_behaviour_types_are_known():
    assert load_content().behavior_types() == {"oneWay", "tunnel", "bonus"}


def test_id_must_match_file_name(tmp_path):
    (tmp_path / "tiles").mkdir()
    (tmp_path / "tiles" / "rock.json").write_text(json.dumps({"id": "stone", "chars": ["r"]}))
    with pytest.raises(ValueError, match="must match the file name"):
        load_content(tmp_path)


def test_cli_check_content(capsys):
    assert main(["--check-content"]) == 0
    out = json.loads(capsys.readouterr().out)
    assert "hedge" in out["pieces"]
    assert out["behaviorsWithoutEncoder"] == []
