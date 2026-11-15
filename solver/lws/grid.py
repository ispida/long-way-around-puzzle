"""Grid helpers, same numbering as src/engine/grid.ts: 1 up, 2 right, 3 down, 4 left, 0 none."""

from __future__ import annotations

UP, RIGHT, DOWN, LEFT = 1, 2, 3, 4
DIRS = (UP, RIGHT, DOWN, LEFT)
DIR_BY_NAME = {"up": UP, "right": RIGHT, "down": DOWN, "left": LEFT}


def step(i: int, d: int, w: int, h: int) -> int:
    """Neighbour of cell i in direction d, or -1 at the border."""
    x = i % w
    if d == UP:
        return i - w if i >= w else -1
    if d == RIGHT:
        return i + 1 if x < w - 1 else -1
    if d == DOWN:
        return i + w if i < w * (h - 1) else -1
    return i - 1 if x > 0 else -1
