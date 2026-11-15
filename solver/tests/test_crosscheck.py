"""A quick version of `npm run solve:verify` (which runs 300 boards)."""

import pytest

from lws import engine
from lws.crosscheck import crosscheck


@pytest.mark.skipif(not engine.available(), reason="needs node and node_modules (npm ci)")
def test_solver_equals_brute_force_on_random_boards():
    assert crosscheck(40, seed=7, counts=20) == []
