/** "My stats" figures from the local store: every daily with a counted (first) walk. */
import { isIsoDate } from "@shared/dates";
import type { Store } from "@storage/store";

export interface PlayedDaily {
  date: string;
  score: number;
  optimum?: number;
}

export interface DailyStats {
  played: PlayedDaily[];
  /** Dailies whose counted score reached the stored optimum. */
  perfect: number;
}

export function dailyStats(store: Pick<Store, "level" | "played">): DailyStats {
  const played = store
    .played()
    .filter(isIsoDate)
    .sort()
    .flatMap((date): PlayedDaily[] => {
      const c = store.level(date).counted;
      if (!c) return [];
      return [{ date, score: c.score, ...(c.optimum !== undefined ? { optimum: c.optimum } : {}) }];
    });
  const perfect = played.filter((p) => p.optimum !== undefined && p.score >= p.optimum).length;
  return { played, perfect };
}

/** The bars of the "distance from the optimum" histogram: +0, -1, -2 and -3 or worse. */
export const GAP_BUCKETS = ["+0", "-1", "-2", "≤-3"] as const;

/** Counted dailies per bucket of (score − optimum); dailies without a stored optimum are left out. */
export function optimumGaps(played: readonly PlayedDaily[]): number[] {
  const counts = GAP_BUCKETS.map(() => 0);
  for (const p of played) {
    if (p.optimum === undefined) continue;
    const below = Math.max(0, p.optimum - p.score);
    const i = Math.min(below, GAP_BUCKETS.length - 1);
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
}
