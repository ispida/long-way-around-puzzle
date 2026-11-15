# Long Way Around

A daily detour puzzle. The bear always takes the shortest route to the honey: place hedges to make that route as long as possible without cutting it off. Every level has a proven best answer, so you always know how close you got.

It is a static site: no server, no accounts, no tracking. Progress is kept in the browser's local storage.

## Run it

Requirements: Node 24 LTS (`.nvmrc`), and for the solver only, Python 3.12 with [uv](https://docs.astral.sh/uv/).

```sh
npm ci
npm run dev          # the game on http://localhost:5173
npm run build        # static site in dist/ (serve it with any static host, with an index.html fallback)
npm run check        # format, lint, typecheck, unit tests, content validation, build
npx playwright install chromium && npm run build:e2e && npm run test:e2e

cd solver && uv sync && uv run pytest
```

## Layout

- `content/` – tiles, pieces, rule sets, themes (pictures + words) and levels: editable without code
  - `content/levels/campaign/` – the 20 campaign levels
  - `content/levels/daily/` – the daily puzzles, one file per date (`/YYYY-MM-DD`)
- `src/` – browser app (`engine` holds the game rules)
- `solver/` – Python exact solver (OR-Tools CP-SAT) that computes each level's optimum
- `tools/` – content validation, solving and level scripts
- `tests/` – engine tests, end-to-end tests (Playwright) and fixtures

## Adding a level

Write a level JSON (see the existing files), then store its optimum and check it:

```sh
npm run solve -- content/levels/daily/2026-11-01.json
npm run validate
```
