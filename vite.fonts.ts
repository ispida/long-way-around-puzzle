/**
 * Build plugin: preloads the fonts visible on first paint (display + body), so text doesn't re-flow
 * when they arrive. Looks the hashed file names up in the bundle.
 */
import type { Plugin } from "vite";

export const PRELOAD_FONTS = [
  /^assets\/bagel-fat-one-latin-400-normal-.*\.woff2$/,
  /^assets\/atkinson-hyperlegible-latin-400-normal-.*\.woff2$/,
];

export function preloadFonts(patterns: readonly RegExp[] = PRELOAD_FONTS): Plugin {
  return {
    name: "lwr-preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const files = Object.keys(ctx.bundle ?? {});
        return patterns.map((p) => {
          const file = files.find((f) => p.test(f));
          if (!file) throw new Error(`preloadFonts: no bundle file matches ${String(p)}`);
          return {
            tag: "link",
            attrs: { rel: "preload", href: `/${file}`, as: "font", type: "font/woff2", crossorigin: "" },
            injectTo: "head" as const,
          };
        });
      },
    },
  };
}
