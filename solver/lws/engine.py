"""Calls the TypeScript engine through tools/engine-cli.ts (JSON in/out) for tests and the cross-check."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CLI = REPO / "tools" / "engine-cli.ts"
TSX = REPO / "node_modules" / ".bin" / "tsx"


def available() -> bool:
    return TSX.exists() and shutil.which("node") is not None


def call(requests: list[dict]) -> list:
    """One node process for a whole batch of requests (start-up costs ~1 s)."""
    out = subprocess.run(
        [str(TSX), "--tsconfig", str(REPO / "tools" / "tsconfig.json"), str(CLI)],
        input=json.dumps(requests),
        capture_output=True,
        text=True,
        cwd=REPO,
        env=os.environ,
        check=True,
    )
    return json.loads(out.stdout)
