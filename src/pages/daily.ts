/**
 * /YYYY-MM-DD: a bundled daily (content/levels/daily) in the play screen, with Previous / Next for the
 * archive; the date above, the puzzle's name as the title. A date without a daily explains itself.
 */
import { parseLevel, ruleTag } from "@engine/index";
import { mountPlay, type PlayHandle } from "@play/screen";
import { el, link } from "@ui/layout";
import { text } from "@ui/text";
import type { PageContext, PageResult } from "./context";

/** The published dates just before and after `date`. */
export function neighbours(dates: readonly string[], date: string): { prev?: string; next?: string } {
  const prev = dates.filter((d) => d < date).at(-1);
  const next = dates.find((d) => d > date);
  return { ...(prev ? { prev } : {}), ...(next ? { next } : {}) };
}

export async function dailyPage(main: HTMLElement, ctx: PageContext, date: string): Promise<PageResult> {
  const level = await ctx.loadDaily(date);
  const dates = ctx.dailyDates;
  if (!level) {
    const latest = dates.at(-1);
    return message(main, date, text.daily.noneTitle, text.daily.none, latest !== date ? latest : undefined);
  }

  const { prev, next } = neighbours(dates, date);
  const section = el("section", "level");
  const nav = el("nav", "level-nav");
  nav.setAttribute("aria-label", "Dailies");
  nav.append(
    prev
      ? link({ href: `/${prev}`, label: text.daily.previous }, "btn small")
      : disabled(text.daily.previous),
    next
      ? link({ href: `/${next}`, label: text.daily.next }, "btn small")
      : disabled(text.daily.next, text.daily.nextTitle),
  );
  const brief = el("div", "brief");
  const eyebrow = el("span", "eyebrow");
  eyebrow.textContent = date;
  const h1 = el("h1");
  h1.textContent = level.name.trim() || date;
  brief.append(eyebrow, h1);
  const host = el("div");
  section.append(nav, brief, host);
  main.replaceChildren(section);

  // A daily played under other rules can be played again; a revisit shows the submitted layout.
  ctx.store.useRules(date, ruleTag(ctx.registry, level.map));
  const counted = ctx.store.level(date).counted;
  const play: PlayHandle = mountPlay(host, {
    board: parseLevel(ctx.registry, level),
    theme: ctx.theme,
    store: ctx.store,
    levelId: date,
    ...(counted ? { initial: new Map(counted.placements) } : {}),
  });
  return {
    title: `${level.name.trim() || "Daily"} (${date})`,
    cleanup: () => play.destroy(),
    onTheme: (t) => {
      ctx.theme = t;
      play.setTheme(t);
    },
  };
}

function disabled(label: string, title?: string): HTMLElement {
  const span = el("span", "btn small disabled");
  span.textContent = label;
  span.setAttribute("aria-disabled", "true");
  if (title) span.title = title;
  return span;
}

function message(main: HTMLElement, date: string, title: string, lead: string, latest?: string): PageResult {
  const section = el("section", "page");
  const eyebrow = el("span", "eyebrow");
  eyebrow.textContent = `Daily puzzle · ${date}`;
  const h1 = el("h1");
  h1.textContent = title;
  const p = el("p", "lead");
  p.textContent = lead;
  const actions = el("div", "controls");
  if (latest) actions.append(link({ href: `/${latest}`, label: text.daily.latest }, "btn primary"));
  actions.append(link({ href: "/campaign", label: text.daily.toCampaign }, "btn"));
  section.append(eyebrow, h1, p, actions);
  main.replaceChildren(section);
  return { title };
}
