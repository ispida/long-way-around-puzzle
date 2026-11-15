/** The theme library of this build: every theme folder under content/themes. */
import { buildLibrary, type ThemeLibrary } from "./library";

const themeFiles = import.meta.glob<unknown>("../../content/themes/*/theme.json", {
  eager: true,
  import: "default",
});
const pictureUrls = import.meta.glob<string>("../../content/themes/*/*/*.{svg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

let cached: ThemeLibrary | undefined;
export const themeLibrary = (): ThemeLibrary => (cached ??= buildLibrary(themeFiles, pictureUrls));

/** Themes players can pick (default is only the fallback base). */
export function selectableThemes(lib: ThemeLibrary = themeLibrary()): { id: string; name: string }[] {
  return [...lib.values()]
    .filter((t) => t.def.id !== "default")
    .sort((a, b) => (a.def.order ?? 999) - (b.def.order ?? 999) || a.def.name.localeCompare(b.def.name))
    .map((t) => ({ id: t.def.id, name: t.def.name }));
}
