/** Campaign unlocking: level n+1 opens once level n has a counted submission. */
import type { CampaignJson } from "@shared/types";
import type { Store } from "@storage/store";

export function isUnlocked(
  campaign: Pick<CampaignJson, "levels" | "unlock">,
  index: number,
  store: Pick<Store, "cleared">,
): boolean {
  if (index < 0 || index >= campaign.levels.length) return false;
  if (campaign.unlock === "all" || index === 0) return true;
  const prev = campaign.levels[index - 1];
  return prev !== undefined && store.cleared(prev);
}
