/** Pointer position -> cell index (or null outside the board). */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function cellAt(rect: Rect, clientX: number, clientY: number, w: number, h: number): number | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor(((clientX - rect.left) / rect.width) * w);
  const y = Math.floor(((clientY - rect.top) / rect.height) * h);
  return x >= 0 && y >= 0 && x < w && y < h ? y * w + x : null;
}
