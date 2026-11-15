"""Bonus tiles (hives): points each time the route enters the cell (src/engine/behaviors/bonus.ts)."""

from __future__ import annotations

TYPE = "bonus"


def apply(b, cell: int, d: dict) -> None:
    b.bonus[cell] = d["points"]
