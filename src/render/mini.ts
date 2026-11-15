/** Small read-only boards (rulebook cards, campaign list): board, hedges and route, nothing interactive. */
import { route, type Board, type Placements } from "@engine/index";
import type { Theme } from "@themes/theme";
import { prepareCanvas } from "./canvas";
import { drawGrid, drawScene } from "./layers";

export function drawMini(
  canvas: HTMLCanvasElement,
  board: Board,
  theme: Theme,
  placements: Placements,
  cell = 32,
): ReturnType<typeof route> {
  const ctx = prepareCanvas(canvas, board.w, board.h, cell);
  const r = route(board, placements);
  drawScene(ctx, { board, theme, cell, placements, route: r, cutOff: !r.open });
  return r;
}

/** An empty grass board of `w × h` tiles (the picture of a campaign slot whose level doesn't exist yet). */
export function drawEmpty(
  canvas: HTMLCanvasElement,
  registry: Board["registry"],
  theme: Theme,
  w: number,
  h: number,
  cell = 32,
): void {
  const ctx = prepareCanvas(canvas, w, h, cell);
  const n = w * h;
  const grass = Math.max(
    0,
    registry.tiles.findIndex((t) => t.id === "grass"),
  );
  drawGrid(
    ctx,
    {
      w,
      h,
      n,
      tileOf: new Uint16Array(n).fill(grass),
      charOf: Array<string>(n).fill("."),
      isGoal: new Uint8Array(n),
      registry,
    },
    theme,
    cell,
  );
}
