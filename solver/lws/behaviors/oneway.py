"""One-way tiles (slopes): moves onto or off the cell go in its direction (src/engine/behaviors/oneWay.ts)."""

from __future__ import annotations

from ..grid import DIR_BY_NAME

TYPE = "oneWay"


def apply(b, cell: int, d: dict) -> None:
    b.one_way[cell] = DIR_BY_NAME[d["dir"]]
