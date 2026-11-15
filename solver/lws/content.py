"""Reads tile, piece and rule-set definitions from content/.

The TypeScript validator (tools/validate-content.ts) is the authority on whether content is valid;
this module only loads it and does light sanity checks.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_CONTENT = Path(__file__).resolve().parents[2] / "content"


@dataclass(frozen=True)
class Content:
    tiles: dict[str, dict] = field(default_factory=dict)
    pieces: dict[str, dict] = field(default_factory=dict)
    rulesets: dict[str, dict] = field(default_factory=dict)

    def char_map(self) -> dict[str, str]:
        """Map character -> tile id."""
        return {c: tid for tid, t in self.tiles.items() for c in t["chars"]}

    def behavior_types(self) -> set[str]:
        return {b["type"] for t in self.tiles.values() for b in t.get("behaviors", [])}


def _load_dir(folder: Path) -> dict[str, dict]:
    if not folder.is_dir():
        return {}
    out: dict[str, dict] = {}
    for f in sorted(folder.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        if data.get("id") != f.stem:
            raise ValueError(f"{f}: id {data.get('id')!r} must match the file name {f.stem!r}")
        out[f.stem] = data
    return out


def load_content(root: Path = DEFAULT_CONTENT) -> Content:
    return Content(
        tiles=_load_dir(root / "tiles"),
        pieces=_load_dir(root / "pieces"),
        rulesets=_load_dir(root / "rulesets"),
    )
