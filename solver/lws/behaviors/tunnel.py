"""Tunnels (burrows): two cells with the same map character are linked (src/engine/behaviors/tunnel.ts)."""

from __future__ import annotations

TYPE = "tunnel"


def apply(b, cell: int, d: dict) -> None:
    b.pending_tunnels.setdefault(b.char_of[cell], []).append(cell)
    b.tunnel_cost[cell] = d["cost"]


def finish(b) -> None:
    for char, cells in b.pending_tunnels.items():
        if len(cells) != 2:
            b.errors.append((f'portal "{char}" needs exactly 2 cells, found {len(cells)}', cells[0]))
            continue
        a, c = cells
        b.partner[a] = c
        b.partner[c] = a
    b.pending_tunnels.clear()
