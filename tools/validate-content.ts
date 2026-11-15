/** CLI: `npm run validate` — checks everything in content/ and exits non-zero on problems. */
import { fileURLToPath } from "node:url";
import { checkContent } from "./content-check";
import { FIXTURE_CAMPAIGN } from "./content-io";

const root = fileURLToPath(new URL("../content", import.meta.url));
const { issues, summary } = checkContent(root, { campaigns: [FIXTURE_CAMPAIGN] });
if (issues.length > 0) {
  console.error(`✗ ${issues.length} problem${issues.length > 1 ? "s" : ""} in content/:`);
  for (const i of issues) console.error(`  ${i.file}: ${i.message}`);
  process.exit(1);
}
console.log(
  `✓ content OK: ${summary.tiles.length} tiles, ${summary.pieces.length} pieces, ` +
    `${summary.rulesets.length} rule sets, ${summary.themes.length} themes, ${summary.levels.length} levels; ${summary.extraLevels.length} test levels`,
);
