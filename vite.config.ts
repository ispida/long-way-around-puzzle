/** The game: a static site, no server needed. */
import { defineConfig } from "vitest/config";
import { preloadFonts } from "./vite.fonts.ts";
import { alias } from "./vite.shared.ts";

export default defineConfig({
  resolve: { alias },
  plugins: [preloadFonts()],
  build: {
    outDir: "dist",
    target: "es2023",
    rollupOptions: { input: "index.html" },
  },
  preview: { port: 4173 },
  test: {
    include: ["src/**/*.test.ts", "tools/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/**", "tools/**"] },
  },
});
