/**
 * /campaign: 20 equal tiles (number, picture, name, state). Played levels show their counted score;
 * locked levels show their board under a "Locked" veil, slots without a level an empty board under
 * "Coming soon".
 */
import { parseLevel } from "@engine/index";
import { drawEmpty, drawMini } from "@render/mini";
import { el } from "@ui/layout";
import { savedText } from "@ui/plural";
import { text } from "@ui/text";
import { CAMPAIGN_SLOTS, type PageContext, type PageResult } from "./context";
import { isUnlocked } from "./progress";

/** Size of the placeholder board for slots without a level. */
const EMPTY = { w: 11, h: 7 };

export function campaignPage(main: HTMLElement, ctx: PageContext): PageResult {
  const section = el("section", "page wide");
  const h1 = el("h1");
  h1.textContent = text.campaign.title;
  const list = el("ol", "level-grid");
  const head = el("div", "page-head");
  head.append(h1);
  section.append(head, list);
  main.replaceChildren(section);

  let alive = true;
  for (let i = 0; i < CAMPAIGN_SLOTS; i++) {
    const id = ctx.campaign.levels[i];
    const li = el("li", "level-card");
    const n = el("span", "n");
    n.textContent = String(i + 1).padStart(2, "0");
    li.append(n);
    list.append(li);
    const open = id !== undefined && isUnlocked(ctx.campaign, i, ctx.store);
    const a = el(open ? "a" : "div", "level-link");
    if (a instanceof HTMLAnchorElement) a.href = `/campaign/lvl${i + 1}`;
    const thumb = el("div", "thumb");
    const preview = el("canvas", "mini");
    preview.setAttribute("aria-hidden", "true");
    thumb.append(preview);
    const name = el("span", "name");
    const state = el("span", "state");
    a.append(thumb, name, state);
    li.append(a);

    if (!id) {
      li.classList.add("coming");
      state.textContent = text.campaign.coming;
      thumb.append(veil(text.campaign.coming));
      drawEmpty(preview, ctx.registry, ctx.theme, EMPTY.w, EMPTY.h, 14);
      continue;
    }
    const counted = ctx.store.level(id).counted;
    state.textContent = !open
      ? text.campaign.locked
      : counted
        ? savedText(counted.score, ctx.theme.text)
        : text.campaign.notPlayed;
    if (!open) {
      li.classList.add("locked");
      thumb.append(veil(text.campaign.locked));
    }
    void ctx.loadCampaignLevel(id).then((level) => {
      if (!alive || !level) return;
      name.textContent = level.name;
      drawMini(preview, parseLevel(ctx.registry, level), ctx.theme, new Map(), 14);
    });
  }
  return { title: text.campaign.title, cleanup: () => (alive = false) };
}

/** The half-transparent cover with a word on it ("Locked", "Coming soon"). */
function veil(label: string): HTMLElement {
  const v = el("span", "veil");
  v.textContent = label;
  v.setAttribute("aria-hidden", "true");
  return v;
}
