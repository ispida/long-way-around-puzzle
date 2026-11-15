/** The animal's route: dotted line for steps, dashed arc for tunnel hops. */
import type { Board, RouteStep } from "@engine/index";
import { COLORS, pick } from "./colors";

export const centre = (board: Board, cell: number, s: number): [number, number] => [
  (cell % board.w) * s + s / 2,
  Math.floor(cell / board.w) * s + s / 2,
];

export function drawRoute(
  ctx: CanvasRenderingContext2D,
  board: Board,
  path: readonly RouteStep[],
  s: number,
  palette: Readonly<Record<string, string>>,
  upto = Infinity,
): void {
  if (path.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let k = 1; k < path.length && k <= upto; k++) {
    const a = path[k - 1];
    const b = path[k];
    if (!a || !b) continue;
    const [ax, ay] = centre(board, a.cell, s);
    const [bx, by] = centre(board, b.cell, s);
    ctx.beginPath();
    if (b.via === "tunnel") {
      ctx.strokeStyle = pick(palette, "pathTunnel", COLORS.pathTunnel);
      ctx.globalAlpha = 1;
      ctx.lineWidth = s * 0.07;
      ctx.setLineDash([s * 0.12, s * 0.14]);
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - s * 1.2, bx, by);
    } else {
      ctx.strokeStyle = pick(palette, "path", COLORS.path);
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = s * 0.1;
      ctx.setLineDash([s * 0.02, s * 0.2]);
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }
  ctx.restore();
}
