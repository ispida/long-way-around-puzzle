/**
 * /rules: the rulebook, one grid of cards (the four rules, then the tiles that bend the route). Every
 * example board is 4 × 7 tiles and drawn by the real engine with the active theme.
 */
import { parseLevel, type Board, type Placements, type Registry } from "@engine/index";
import { drawMini } from "@render/mini";
import { LevelSchema } from "@shared/schemas";
import { el } from "@ui/layout";
import { text } from "@ui/text";
import type { PageContext, PageResult } from "./context";

interface Card {
  title: string;
  text: string;
  map: string[];
  hedges: [number, number][];
}

const FIELD = [".......", "B.....H", ".......", "......."];
const CORE: Card[] = [
  {
    title: "1. It saves as little as it can",
    text: "The {animal} takes the way that saves the least: usually the shortest.",
    map: FIELD,
    hedges: [],
  },
  {
    title: "2. Send it the long way around",
    text: "{pieces|cap} on the route force a longer one.",
    map: FIELD,
    hedges: [
      [3, 0],
      [3, 1],
      [3, 2],
    ],
  },
  {
    title: "3. Never trap it",
    text: "No way out = nothing saved.",
    map: FIELD,
    hedges: [
      [3, 0],
      [3, 1],
      [3, 2],
      [3, 3],
    ],
  },
  {
    title: "4. Every step saves {food|lower}",
    text: "Each step saves one {unit}.",
    map: FIELD,
    hedges: [
      [2, 0],
      [2, 1],
      [2, 2],
      [4, 1],
      [4, 2],
      [4, 3],
    ],
  },
];

export function rulesPage(main: HTMLElement, ctx: PageContext): PageResult {
  const page = el("div", "rules-page");
  const head = el("section", "page");
  const h1 = el("h1");
  h1.textContent = text.rules.title;
  head.append(h1);

  page.append(head, section(text.rules.coreTitle, [...CORE, ...tileCards(ctx.registry)], ctx));
  main.replaceChildren(page);
  return { title: text.rules.title };
}

const GROUP_ORDER = ["terrain", "obstacle", "special", "actor"];

/** One card per tile `card` that has an example board (slopes share one card), in palette order. */
function tileCards(registry: Registry): Card[] {
  const seen = new Set<string>();
  const cards: Card[] = [];
  const tiles = [...registry.tiles].sort(
    (a, b) =>
      GROUP_ORDER.indexOf(a.editor.group) - GROUP_ORDER.indexOf(b.editor.group) ||
      a.editor.order - b.editor.order,
  );
  for (const t of tiles) {
    const c = t.card;
    if (!c?.example || t.editor.hidden || seen.has(c.title)) continue;
    seen.add(c.title);
    cards.push({ title: c.title, text: c.text, map: c.example.map, hedges: c.example.hedges });
  }
  return cards;
}

function section(title: string, cards: Card[], ctx: PageContext): HTMLElement {
  const s = el("section", "rules");
  const h2 = el("h2");
  h2.textContent = title;
  const grid = el("div", "cards");
  for (const c of cards) grid.append(card(c, ctx));
  s.append(h2, grid);
  return s;
}

function card(c: Card, ctx: PageContext): HTMLElement {
  const box = el("article", "card");
  const canvas = el("canvas", "mini");
  canvas.setAttribute("aria-hidden", "true");
  const h3 = el("h3");
  h3.textContent = ctx.theme.text(c.title);
  const p = el("p");
  p.textContent = ctx.theme.text(c.text);
  box.append(canvas, h3, p);

  const level = LevelSchema.parse({
    schema: 1,
    id: "card",
    name: c.title,
    tag: "rules",
    text: "",
    map: c.map,
    pieces: { hedge: Math.max(1, c.hedges.length) },
  });
  const board: Board = parseLevel(ctx.registry, level);
  const placements: Placements = new Map(c.hedges.map(([x, y]) => [y * board.w + x, "hedge"]));
  drawMini(canvas, board, ctx.theme, placements, 36);
  return box;
}
