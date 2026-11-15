"""parse_level: level JSON + content -> Board, mirroring src/engine/board.ts.

tests/test_board.py checks these facts against the TypeScript engine (tools/engine-cli.ts).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .behaviors import ENCODERS
from .content import Content


class LevelError(ValueError):
    pass


@dataclass
class _Builder:
    w: int
    h: int
    char_of: list[str]
    one_way: list[int]
    partner: list[int]
    tunnel_cost: list[int]
    bonus: list[int]
    errors: list[tuple[str, int]] = field(default_factory=list)
    pending_tunnels: dict[str, list[int]] = field(default_factory=dict)


@dataclass(frozen=True)
class Board:
    w: int
    h: int
    tile_of: list[str]
    walkable: list[int]
    cost: list[int]
    one_way: list[int]
    partner: list[int]
    tunnel_cost: list[int]
    bonus: list[int]
    start: int
    goals: list[int]
    piece_ids: list[str]
    budgets: list[int]
    placeable: dict[str, list[int]]
    effects: dict[str, dict]
    ruleset: dict

    @property
    def n(self) -> int:
        return self.w * self.h

    def facts(self) -> dict:
        """Same shape as boardFacts() in tools/engine-cli.ts."""
        return {
            "w": self.w,
            "h": self.h,
            "walkable": self.walkable,
            "cost": self.cost,
            "oneWay": self.one_way,
            "partner": self.partner,
            "tunnelCost": self.tunnel_cost,
            "bonus": self.bonus,
            "start": self.start,
            "goals": self.goals,
            "pieceIds": self.piece_ids,
            "budgets": self.budgets,
            "placeable": self.placeable,
        }


def parse_level(content: Content, level: dict) -> Board:
    rows: list[str] = level["map"]
    h = len(rows)
    w = len(rows[0]) if rows else 0
    n = w * h
    if n == 0:
        raise LevelError("the map is empty")
    ruleset = content.rulesets.get(level.get("rules", "default"))
    if ruleset is None:
        raise LevelError(f'unknown rule set "{level.get("rules")}"')

    by_char = content.char_map()
    tile_of: list[str] = []
    char_of: list[str] = []
    walkable = [0] * n
    cost = [0] * n
    goals: list[int] = []
    start = -1
    for y, row in enumerate(rows):
        if len(row) != w:
            raise LevelError(f"row {y + 1} has {len(row)} cells, expected {w}")
        for x, c in enumerate(row):
            i = y * w + x
            tid = by_char.get(c)
            if tid is None:
                raise LevelError(f'unknown map character "{c}"')
            tile = content.tiles[tid]
            tile_of.append(tid)
            char_of.append(c)
            walkable[i] = 1 if tile["walkable"] else 0
            # Unwalkable tiles keep the schema default of 1, as in the engine.
            cost[i] = tile.get("cost", 1)
            role = tile.get("role")
            if role == "start":
                if start != -1:
                    raise LevelError("more than one start")
                start = i
            elif role == "goal":
                goals.append(i)
    if start == -1:
        raise LevelError("no start")
    if not goals:
        raise LevelError("no goal")

    b = _Builder(w, h, char_of, [0] * n, [-1] * n, [0] * n, [0] * n)
    used: list[str] = []
    for i in range(n):
        for d in content.tiles[tile_of[i]].get("behaviors", []):
            enc = ENCODERS.get(d["type"])
            if enc is None:
                raise LevelError(f'behaviour "{d["type"]}" has no solver module')
            if d["type"] not in used:
                used.append(d["type"])
            enc.apply(b, i, d)
    for t in used:
        fin = getattr(ENCODERS[t], "finish", None)
        if fin:
            fin(b)
    if b.errors:
        raise LevelError(b.errors[0][0])

    piece_ids = sorted(level["pieces"])
    goal_set = set(goals)
    placeable: dict[str, list[int]] = {}
    effects: dict[str, dict] = {}
    for p in piece_ids:
        if p not in content.pieces:
            raise LevelError(f'unknown piece "{p}"')
        effects[p] = content.pieces[p]["effect"]
        placeable[p] = [
            i
            for i in range(n)
            if p in content.tiles[tile_of[i]].get("accepts", []) and i != start and i not in goal_set
        ]

    return Board(
        w=w,
        h=h,
        tile_of=tile_of,
        walkable=walkable,
        cost=cost,
        one_way=b.one_way,
        partner=b.partner,
        tunnel_cost=b.tunnel_cost,
        bonus=b.bonus,
        start=start,
        goals=goals,
        piece_ids=piece_ids,
        budgets=[level["pieces"][p] for p in piece_ids],
        placeable=placeable,
        effects=effects,
        ruleset=ruleset,
    )
