/**
 * A small bar histogram (leaderboard pop-up, "My stats"). Plain bars in HTML, so the colours come
 * from the CSS tokens and follow the light/dark theme. Bars carry their count above and a label below.
 */
import { el } from "./layout";

export interface Bar {
  /** Shown under the bar; empty leaves the bar unlabelled (with many bars only every few are). */
  label: string;
  count: number;
  /** Long description for the hover title and screen readers, e.g. "Score 30: 3 players". */
  title: string;
  /** The bar of the current player (highlighted). */
  current?: boolean;
}

/**
 * `axis.y` names the bars' axis above them; left out, the counts on the bars speak for themselves.
 * `counts: false` leaves the numbers off the bars (long series: the hover title still has them).
 */
export function renderHistogram(
  bars: readonly Bar[],
  axis: { x: string; y?: string },
  opts: { counts?: boolean } = {},
): HTMLElement {
  const fig = el("figure", "histogram");
  // Many bars get smaller numbers and labels, so they still fit side by side.
  const size = bars.length > 16 ? " tiny" : bars.length > 10 ? " dense" : "";
  const plot = el("div", `hist-plot${size}`);
  plot.setAttribute("role", "list");
  const max = Math.max(1, ...bars.map((b) => b.count));
  for (const b of bars) {
    const col = el("div", b.current ? "hist-col current" : "hist-col");
    col.setAttribute("role", "listitem");
    col.title = b.title;
    col.setAttribute("aria-label", b.title);
    const n = el("span", "hist-n");
    n.textContent = String(b.count);
    n.setAttribute("aria-hidden", "true");
    const bar = el("span", "hist-bar");
    bar.style.height = `${(b.count / max) * 100}%`;
    const label = el("span", "hist-x");
    label.textContent = b.label || "\u00a0"; // an unlabelled bar keeps the row height
    label.setAttribute("aria-hidden", "true");
    const track = el("span", "hist-track");
    if (opts.counts === false) track.append(bar);
    else track.append(n, bar);
    col.append(track, label);
    plot.append(col);
  }
  // The y axis is named above the bars (if at all), the x axis below them.
  const x = el("figcaption", "hist-axes");
  x.textContent = axis.x;
  if (axis.y) {
    const y = el("span", "hist-y");
    y.textContent = axis.y;
    fig.append(y);
  }
  fig.append(plot, x);
  return fig;
}

export interface ScoreBin {
  from: number;
  to: number;
  count: number;
}

/** How many players reached each score: `[score, players]`. */
export type Counts = readonly (readonly [number, number])[];

/**
 * Every score from the lowest to the highest that players reached, empty ones included (count 0), so the
 * bars show how far apart the scores are. When that span is wider than `maxBars`, each bar covers the
 * same number of scores (2, 3, …), starting at the lowest.
 */
export function scoreBins(counts: Counts, maxBars = 24): ScoreBin[] {
  const reached = counts.filter(([, n]) => n > 0);
  if (reached.length === 0) return [];
  const scores = reached.map(([s]) => s);
  const lo = Math.min(...scores);
  const span = Math.max(...scores) - lo + 1;
  const width = Math.ceil(span / maxBars);
  const bins: ScoreBin[] = Array.from({ length: Math.ceil(span / width) }, (_, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width - 1,
    count: 0,
  }));
  for (const [s, n] of reached) bins[Math.floor((s - lo) / width)]!.count += n;
  return bins;
}
