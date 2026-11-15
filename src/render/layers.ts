/**
 * Draws a board in layers: ground → tiles → pieces → goals → route → bonus badges → overlays → animal.
 * Pictures come from the theme; nothing here knows about bears or pandas.
 */
import type { Board, Placements, RouteResult } from "@engine/index";
import type { Theme } from "@themes/theme";
import { COLORS, pick } from "./colors";
import { centre, drawRoute } from "./route-line";

export interface Scene {
  board: Board;
  theme: Theme;
  /** Cell size in CSS pixels. */
  cell: number;
  placements: Placements;
  route?: RouteResult | undefined;
  /** Draw the route only up to this path index (walk animation). */
  upto?: number | undefined;
  /** Animal position in CSS pixels; defaults to the start cell. */
  animalAt?: [number, number] | undefined;
  /**
   * While walking: half cells walked (picks the walk frame) and the walking picture is mirrored when it
   * heads left (-1). Otherwise it sits.
   */
  walking?: { facing: 1 | -1; stride: number } | undefined;
  hover?: { cell: number; ok: boolean } | null | undefined;
  cursor?: number | null | undefined;
  ghost?: Placements | undefined;
  cutOff?: boolean | undefined;
}

/** What drawing the tiles needs: a parsed board has all of it, and the editor builds one for drafts. */
export type GridView = Pick<Board, "w" | "h" | "n" | "tileOf" | "charOf" | "isGoal" | "registry">;

/** Ground, tiles, pieces and food: everything except routes, overlays and the animal. */
export function drawGrid(
  ctx: CanvasRenderingContext2D,
  grid: GridView,
  theme: Theme,
  s: number,
  placements: Placements = new Map(),
): void {
  ctx.clearRect(0, 0, grid.w * s, grid.h * s);
  for (let i = 0; i < grid.n; i++) {
    const x = i % grid.w;
    const y = Math.floor(i / grid.w);
    const px = x * s;
    const py = y * s;
    image(ctx, theme.ground(x, y), px, py, s);
    const t = grid.tileOf[i] ?? 0;
    const def = grid.registry.tiles[t];
    if (def?.image?.tintBy === "char") {
      const digit = Number(grid.charOf[i]) || 1;
      ellipse(
        ctx,
        px + s / 2,
        py + s / 2,
        s * 0.36,
        s * 0.27,
        COLORS.rings[(digit - 1) % COLORS.rings.length] ?? COLORS.missing,
      );
    }
    const pic = theme.tile(t, x, y);
    if (pic) image(ctx, pic, px, py, s, theme.rotation(t));
    const piece = placements.get(i);
    if (piece) image(ctx, theme.piece(piece), px, py, s);
    if (grid.isGoal[i]) image(ctx, theme.actor("food"), px, py, s);
  }
}

/** The animal centred on a cell (the editor draws it on a draft's start). */
export function drawAnimal(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  w: number,
  cell: number,
  s: number,
): void {
  image(ctx, theme.actor("animal"), (cell % w) * s, Math.floor(cell / w) * s, s);
}

/** A rounded outline around one cell (hover, cursor, editor highlights). */
export function outlineCell(
  ctx: CanvasRenderingContext2D,
  w: number,
  c: number,
  s: number,
  colour: string,
  width: number,
): void {
  ctx.save();
  ctx.lineWidth = width;
  ctx.strokeStyle = colour;
  roundRect(ctx, (c % w) * s + 2, Math.floor(c / w) * s + 2, s - 4, s - 4, s * 0.15, "stroke");
  ctx.restore();
}

/**
 * The badge over a route tile (0 = none): the hive's bonus (+5), or what a costly tile such as mud
 * counts (+3), so the player sees what passing it saves. The start (route index 0) gets none.
 */
export function badgeFor(board: Pick<Board, "bonus" | "cost">, cell: number, k: number): number {
  const bonus = board.bonus[cell] ?? 0;
  if (bonus !== 0) return bonus;
  const cost = board.cost[cell] ?? 1;
  return k > 0 && cost > 1 ? cost : 0;
}

export function drawScene(ctx: CanvasRenderingContext2D, sc: Scene): void {
  const { board, theme, cell: s } = sc;
  const palette = theme.palette;
  drawGrid(ctx, board, theme, s, sc.placements);

  if (sc.ghost) {
    ctx.save();
    ctx.setLineDash([s * 0.12, s * 0.08]);
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.strokeStyle = pick(palette, "ghost", COLORS.ghost);
    for (const c of sc.ghost.keys())
      roundRect(
        ctx,
        (c % board.w) * s + s * 0.12,
        Math.floor(c / board.w) * s + s * 0.14,
        s * 0.76,
        s * 0.74,
        s * 0.18,
        "stroke",
      );
    ctx.restore();
  }

  if (sc.route?.open) {
    drawRoute(ctx, board, sc.route.path, s, palette, sc.upto);
    const reached = sc.upto ?? Infinity;
    sc.route.path.forEach((p, k) => {
      const bonus = badgeFor(board, p.cell, k);
      if (bonus === 0 || k > reached) return;
      const [cx, cyCell] = centre(board, p.cell, s);
      // Badge above the tile; in the top row it goes below so it isn't cut off.
      const cy = cyCell - s * 0.62 < 0 ? cyCell + s * 0.62 : cyCell;
      ctx.fillStyle = COLORS.badge;
      roundRect(ctx, cx - s * 0.3, cy - s * 0.62, s * 0.6, s * 0.3, s * 0.15, "fill");
      ctx.fillStyle = COLORS.badgeText;
      ctx.font = `700 ${Math.round(s * 0.22)}px "DM Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${bonus > 0 ? "+" : ""}${bonus}`, cx, cy - s * 0.47);
    });
  }

  const outline = (c: number, colour: string, width: number) =>
    outlineCell(ctx, board.w, c, s, colour, width);
  if (sc.hover) outline(sc.hover.cell, sc.hover.ok ? COLORS.hoverOk : COLORS.hoverBad, Math.max(2, s * 0.06));
  if (sc.cursor != null) outline(sc.cursor, COLORS.cursor, Math.max(3, s * 0.08));

  if (sc.cutOff) {
    ctx.fillStyle = pick(palette, "cutOff", COLORS.cutOff);
    ctx.fillRect(0, 0, board.w * s, board.h * s);
  }

  const [ax, ay] = sc.animalAt ?? centre(board, board.start, s);
  const pic = (sc.walking && theme.walk(sc.walking.stride)) || theme.actor("animal");
  if (sc.walking?.facing === -1 && pic) {
    ctx.save();
    ctx.translate(ax, 0);
    ctx.scale(-1, 1);
    image(ctx, pic, -s / 2, ay - s / 2, s);
    ctx.restore();
  } else image(ctx, pic, ax - s / 2, ay - s / 2, s);
}

function image(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource | undefined,
  x: number,
  y: number,
  s: number,
  rotate = 0,
): void {
  if (!img) return;
  if (rotate === 0) {
    ctx.drawImage(img, x, y, s, s);
    return;
  }
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  ctx.restore();
}

function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  mode: "fill" | "stroke",
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (mode === "fill") ctx.fill();
  else ctx.stroke();
}
