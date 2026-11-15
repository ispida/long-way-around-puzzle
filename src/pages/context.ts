/** What pages get from the app: content, the player's store and the active theme. */
import type { Registry } from "@engine/index";
import type { CampaignJson, LevelJson } from "@shared/types";
import type { Store } from "@storage/store";
import type { Theme } from "@themes/theme";

export interface PageContext {
  registry: Registry;
  campaign: CampaignJson;
  loadCampaignLevel(id: string): Promise<LevelJson | undefined>;
  store: Store;
  /** The active theme (pictures loaded). */
  theme: Theme;
  /** Dates of the bundled dailies, oldest first. */
  dailyDates: readonly string[];
  loadDaily(date: string): Promise<LevelJson | undefined>;
}

export interface PageResult {
  title: string;
  /** Called before the next page renders (stop animations, observers). */
  cleanup?: () => void;
  /** If present, a theme switch calls this instead of re-rendering the page (keeps unsaved hedges). */
  onTheme?: (theme: Theme) => void;
}

export const CAMPAIGN_SLOTS = 20;
