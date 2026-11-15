/** Settings shared by the app build and the tests. */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MODULES = ["shared", "engine", "themes", "render", "ui", "play", "pages", "app", "storage"];

/**
 * Where the bundled campaign comes from: content/levels/campaign, or LWR_CAMPAIGN_DIR. The e2e build
 * uses tests/fixtures/campaign, so the tests don't depend on the real levels.
 */
export const campaignDir = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  process.env.LWR_CAMPAIGN_DIR ?? "content/levels/campaign",
);

/** Where the bundled dailies come from: content/levels/daily, or LWR_DAILY_DIR (tests/fixtures/daily for e2e). */
export const dailyDir = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  process.env.LWR_DAILY_DIR ?? "content/levels/daily",
);

/** Path aliases matching tsconfig.base.json ("@engine/route" -> src/engine/route), plus @campaign and @dailies. */
export const alias = [
  ...MODULES.map((m) => ({
    find: new RegExp(`^@${m}/`),
    replacement: fileURLToPath(new URL(`./src/${m}/`, import.meta.url)),
  })),
  { find: /^@campaign\//, replacement: `${campaignDir}/` },
  { find: /^@dailies\//, replacement: `${dailyDir}/` },
];
