"""One module per behaviour type, mirroring src/engine/behaviors/.

Each module fills the board facts while a level is parsed (`apply` per cell, optional `finish`).
The CP-SAT model (lws/model.py) builds its edges from those facts exactly like src/engine/route.ts,
so a new behaviour needs a module here and, if it changes how the animal moves, a matching edge rule
in the model.
"""

from types import ModuleType

from . import bonus, oneway, tunnel

ENCODERS: dict[str, ModuleType] = {m.TYPE: m for m in (oneway, tunnel, bonus)}
