/**
 * A loaded theme: pictures decoded and ready to draw synchronously, plus its words and palette.
 * Loading happens once per theme; switching back is instant.
 */
import type { Registry } from "@engine/index";
import { fillWords } from "@shared/placeholders";
import {
  findPicture,
  findWalkFrames,
  mergedWords,
  themeChain,
  variantIndex,
  type ThemeLibrary,
} from "./library";

export interface Theme {
  id: string;
  name: string;
  words: Readonly<Record<string, string>>;
  palette: Readonly<Record<string, string>>;
  /** Fills {placeholders} with this theme's words. */
  text: (t: string) => string;
  /** Ground picture (grass) drawn under every cell. */
  ground(x: number, y: number): CanvasImageSource | undefined;
  /** Picture for a tile at (x, y); undefined for tiles that are plain ground (grass, start, goal). */
  tile(tileIndex: number, x: number, y: number): CanvasImageSource | undefined;
  piece(pieceId: string): CanvasImageSource | undefined;
  /** "animal" sits at the start. */
  actor(name: "animal" | "food"): CanvasImageSource | undefined;
  /**
   * The walking animal (on all fours, facing right) for a distance walked in half cells: frames
   * animal-walk.svg, animal-walk.2.svg, … take turns, so the legs move with the steps. Undefined when the
   * theme's animal has no walk; it then slides along sitting.
   */
  walk(stride: number): CanvasImageSource | undefined;
  /** Rotation in degrees for a tile's picture (one picture for all slope directions). */
  rotation(tileIndex: number): number;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not load picture ${url}`));
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

/** Actor pictures are drawn up to this size (MAX_CELL 88 px at 3× pixel density). */
const ACTOR_PX = 256;

/**
 * Draws a picture once onto a canvas, so a detailed SVG (an animal traced with hundreds of paths) isn't
 * rendered again on every frame of the walk. Falls back to the image where there is no canvas.
 */
function rasterize(img: HTMLImageElement): CanvasImageSource {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = ACTOR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img;
  ctx.drawImage(img, 0, 0, ACTOR_PX, ACTOR_PX);
  return canvas;
}

const themeCache = new Map<string, Promise<Theme>>();

export function loadTheme(lib: ThemeLibrary, registry: Registry, id: string): Promise<Theme> {
  const key = id;
  let p = themeCache.get(key);
  if (!p) {
    p = build(lib, registry, id);
    themeCache.set(key, p);
  }
  return p;
}

async function build(lib: ThemeLibrary, registry: Registry, id: string): Promise<Theme> {
  const chain = themeChain(lib, id);
  const entry = lib.get(chain[0] ?? "default");
  const words = mergedWords(lib, chain);
  const palette: Record<string, string> = {};
  for (const t of [...chain].reverse()) Object.assign(palette, lib.get(t)?.def.palette ?? {});

  const urls = new Set<string>();
  const tileUrls = registry.tiles.map((t) => findPicture(lib, chain, "tiles", t.image?.base ?? t.id) ?? []);
  const pieceUrls = new Map(
    registry.pieces.map((p) => [p.id, findPicture(lib, chain, "pieces", p.id) ?? []]),
  );
  const actorUrls = {
    animal: findPicture(lib, chain, "actors", "animal") ?? [],
    food: findPicture(lib, chain, "actors", "food") ?? [],
  };
  const walkUrls = findWalkFrames(lib, chain);
  const grassUrls = findPicture(lib, chain, "tiles", "grass") ?? [];
  const actorSet = new Set([...actorUrls.animal, ...actorUrls.food, ...walkUrls]);
  for (const list of [...tileUrls, ...pieceUrls.values(), [...actorSet], grassUrls]) {
    for (const u of list) urls.add(u);
  }
  const images = new Map<string, CanvasImageSource>();
  await Promise.all(
    [...urls].map(async (u) => {
      try {
        const img = await loadImage(u);
        images.set(u, actorSet.has(u) ? rasterize(img) : img);
      } catch {
        // a missing picture leaves a gap rather than breaking the game
      }
    }),
  );
  const pick = (list: string[], x = 0, y = 0) => {
    const u = list[variantIndex(x, y, list.length)];
    return u ? images.get(u) : undefined;
  };

  return {
    id: chain[0] ?? "default",
    name: entry?.def.name ?? "Default",
    words,
    palette,
    text: (t) => fillWords(t, words),
    ground: (x, y) => pick(grassUrls, x, y),
    tile: (i, x, y) => {
      const list = tileUrls[i] ?? [];
      return list === grassUrls || list[0] === grassUrls[0] ? undefined : pick(list, x, y);
    },
    piece: (pid) => pick(pieceUrls.get(pid) ?? []),
    actor: (name) => pick(actorUrls[name]),
    walk: (stride) => {
      const u = walkUrls[Math.floor(Math.max(0, stride)) % Math.max(1, walkUrls.length)];
      return u ? images.get(u) : undefined;
    },
    rotation: (i) => registry.tiles[i]?.image?.rotate ?? 0,
  };
}
