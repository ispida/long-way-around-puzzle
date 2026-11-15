/**
 * Histogram bars for the scores pop-up: this browser's own score.
 */
import type { LevelProgress } from "@storage/store";
import { scoreBins, type Bar, type Counts } from "@ui/histogram";

/** This browser's counted score as counts. */
export function localCounts(p: LevelProgress): [number, number][] {
  return p.counted ? [[p.counted.score, 1]] : [];
}

/** Bars with a label: at most this many, so the numbers under them stay readable on a phone. */
const MAX_LABELS = 12;

/**
 * One bar per score bin, empty scores included; the bin holding `current` (the player's score) is
 * highlighted. Labels show the bin's lowest score (no ranges like "23–24"); with many bars only every
 * few get one, the lowest always. The hover title names the full range.
 */
export function scoreBars(
  counts: Counts,
  current: number | undefined,
  describe: (range: string, count: number) => string,
): Bar[] {
  const bins = scoreBins(counts);
  const every = Math.ceil(bins.length / MAX_LABELS);
  return bins.map((b, i) => {
    const range = b.from === b.to ? String(b.from) : `${b.from}–${b.to}`;
    const isCurrent = current !== undefined && current >= b.from && current <= b.to;
    return {
      label: i % every === 0 ? String(b.from) : "",
      count: b.count,
      title: describe(range, b.count),
      ...(isCurrent ? { current: true } : {}),
    };
  });
}
