/**
 * Canvas sizing: cell size from the available width (20–88 px), sharp on high-DPI screens. 20 px lets a
 * 16-column board fit a 360 px phone; wider phones get 22 px or more.
 */
export const MIN_CELL = 20;
export const MAX_CELL = 88;

export function cellSize(availableWidth: number, w: number): number {
  return Math.max(MIN_CELL, Math.min(MAX_CELL, Math.floor(availableWidth / w)));
}

/** Resizes the canvas for `w × h` cells and returns its 2D context in CSS-pixel units. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  cell: number,
): CanvasRenderingContext2D {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * cell * dpr);
  canvas.height = Math.round(h * cell * dpr);
  canvas.style.aspectRatio = `${w} / ${h}`;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2D is not available");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
