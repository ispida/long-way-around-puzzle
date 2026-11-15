/**
 * Theme library: theme.json files and picture URLs, collected at build time.
 * Pictures are found by file name: <theme>/<kind>/<name>[.<variant>].<svg|png|webp>.
 */
import { ThemeSchema } from "@shared/schemas";
import type { ThemeDef } from "@shared/types";

export type PictureKind = "tiles" | "pieces" | "actors";

export interface ThemeEntry {
  def: ThemeDef;
  /** "tiles/grass" -> variant URLs, base picture first. */
  pictures: Map<string, string[]>;
}

export type ThemeLibrary = ReadonlyMap<string, ThemeEntry>;

const FILE = /\/content\/themes\/([^/]+)\/(tiles|pieces|actors)\/([a-z0-9-]+)(?:\.(\d+))?\.(svg|png|webp)$/;

/** Builds the library from theme.json values and picture URLs keyed by file path. */
export function buildLibrary(
  themeFiles: Record<string, unknown>,
  pictureUrls: Record<string, string>,
): ThemeLibrary {
  const lib = new Map<string, ThemeEntry>();
  for (const path of Object.keys(themeFiles).sort()) {
    const def = ThemeSchema.parse(themeFiles[path]);
    lib.set(def.id, { def, pictures: new Map() });
  }
  const variants = new Map<string, { n: number; url: string }[]>();
  for (const [path, url] of Object.entries(pictureUrls)) {
    const m = FILE.exec(path);
    if (!m) continue;
    const key = `${m[1]}|${m[2]}/${m[3]}`;
    const list = variants.get(key) ?? [];
    list.push({ n: m[4] ? Number(m[4]) : 1, url });
    variants.set(key, list);
  }
  for (const [key, list] of variants) {
    const [theme, name] = key.split("|") as [string, string];
    lib.get(theme)?.pictures.set(
      name,
      list.sort((a, b) => a.n - b.n).map((v) => v.url),
    );
  }
  return lib;
}

/** Theme ids from the theme to the root: e.g. icebear -> panda -> default. */
export function themeChain(lib: ThemeLibrary, id: string): string[] {
  const chain: string[] = [];
  for (
    let t: string | undefined = lib.has(id) ? id : "default";
    t && !chain.includes(t);
    t = lib.get(t)?.def.extends
  ) {
    chain.push(t);
  }
  if (!chain.includes("default") && lib.has("default")) chain.push("default");
  return chain;
}

/** Variant URLs for a picture, from the first theme in the chain that has it. */
export function findPicture(
  lib: ThemeLibrary,
  chain: readonly string[],
  kind: PictureKind,
  name: string,
): string[] | undefined {
  for (const t of chain) {
    const urls = lib.get(t)?.pictures.get(`${kind}/${name}`);
    if (urls && urls.length > 0) return urls;
  }
  return undefined;
}

/**
 * Walk frames (actors/animal-walk.svg, animal-walk.2.svg, …) from the theme whose sitting animal is used,
 * so a theme that brings its own animal never walks as its parent's. Empty when that theme has none.
 */
export function findWalkFrames(lib: ThemeLibrary, chain: readonly string[]): string[] {
  const owner = chain.find((t) => (lib.get(t)?.pictures.get("actors/animal")?.length ?? 0) > 0);
  return (owner && lib.get(owner)?.pictures.get("actors/animal-walk")) || [];
}

/** Words merged along the chain (the theme's own words win). */
export function mergedWords(lib: ThemeLibrary, chain: readonly string[]): Record<string, string> {
  const words: Record<string, string> = {};
  for (const t of [...chain].reverse()) Object.assign(words, lib.get(t)?.def.words ?? {});
  return words;
}

/** Stable variant choice per cell, so the board looks varied but never flickers. */
export function variantIndex(x: number, y: number, count: number): number {
  if (count <= 1) return 0;
  const h = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  return h % count;
}
