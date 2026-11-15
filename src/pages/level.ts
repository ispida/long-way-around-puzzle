/**
 * /campaign/lvlN: Previous / Next level at the top, the level name, then the play screen.
 * Locked or unknown levels explain themselves.
 */
import { parseLevel } from "@engine/index";
import { mountPlay, type PlayHandle } from "@play/screen";
import { el, link } from "@ui/layout";
import { text } from "@ui/text";
import type { PageContext, PageResult } from "./context";
import { isUnlocked } from "./progress";

export async function levelPage(main: HTMLElement, ctx: PageContext, n: number): Promise<PageResult> {
  const index = n - 1;
  const id = ctx.campaign.levels[index];
  const level = id ? await ctx.loadCampaignLevel(id) : undefined;
  if (!id || !level) return message(main, `Level ${n}`, text.campaign.unknownLevel);
  if (!isUnlocked(ctx.campaign, index, ctx.store))
    return message(main, `Level ${n}`, text.campaign.lockedLevel);

  const board = parseLevel(ctx.registry, level);
  const section = el("section", "level");
  const nav = el("nav", "level-nav");
  nav.setAttribute("aria-label", "Levels");
  const brief = el("div", "brief");
  const eyebrow = el("span", "eyebrow");
  eyebrow.textContent = `Level ${n} · ${level.tag}`;
  const h1 = el("h1");
  h1.textContent = level.name;
  brief.append(eyebrow, h1);
  const host = el("div");
  section.append(nav, brief, host);
  main.replaceChildren(section);

  const nextId = ctx.campaign.levels[index + 1];
  /** Previous is always open; Next only once it exists and is unlocked. */
  const renderNav = () => {
    const prev =
      index > 0
        ? link({ href: `/campaign/lvl${n - 1}`, label: text.levelNav.previous }, "btn small")
        : disabled(text.levelNav.previous);
    const nextOpen = nextId !== undefined && isUnlocked(ctx.campaign, index + 1, ctx.store);
    const next = nextOpen
      ? link({ href: `/campaign/lvl${n + 1}`, label: text.levelNav.next }, "btn small")
      : disabled(text.levelNav.next, nextId ? text.levelNav.nextLocked : undefined);
    nav.replaceChildren(prev, next);
  };
  renderNav();

  // A revisit shows the submitted layout.
  const counted = ctx.store.level(id).counted;
  const play: PlayHandle = mountPlay(host, {
    board,
    theme: ctx.theme,
    store: ctx.store,
    levelId: id,
    ...(counted ? { initial: new Map(counted.placements) } : {}),
    onSubmitted: renderNav,
  });

  return {
    title: `Level ${n}: ${level.name}`,
    cleanup: () => play.destroy(),
    onTheme: (t) => {
      ctx.theme = t;
      play.setTheme(t);
    },
  };
}

/** A greyed-out nav button that explains why it can't be used. */
function disabled(label: string, title?: string): HTMLElement {
  const span = el("span", "btn small disabled");
  span.textContent = label;
  span.setAttribute("aria-disabled", "true");
  if (title) span.title = title;
  return span;
}

function message(main: HTMLElement, title: string, lead: string): PageResult {
  const section = el("section", "page");
  const h1 = el("h1");
  h1.textContent = title;
  const p = el("p", "lead");
  p.textContent = lead;
  section.append(h1, p, link({ href: "/campaign", label: text.result.toCampaign }));
  main.replaceChildren(section);
  return { title };
}
