/** /stats: played dailies from this browser's store. */
import { renderHistogram } from "@ui/histogram";
import { el, link } from "@ui/layout";
import { text } from "@ui/text";
import type { PageContext, PageResult } from "./context";
import { dailyStats, GAP_BUCKETS, optimumGaps } from "./stats-data";

export function statsPage(main: HTMLElement, ctx: PageContext): PageResult {
  const st = dailyStats(ctx.store);

  const section = el("section", "page stats");
  const h1 = el("h1");
  h1.textContent = text.stats.title;
  const lead = el("p", "lead");
  lead.textContent = text.stats.lead;
  section.append(h1, lead);

  const figures = el("dl", "stat-row");
  const add = (label: string, value: string) => {
    const box = el("div", "stat");
    const l = el("dt");
    l.textContent = `${label}:`;
    const v = el("dd");
    v.textContent = value;
    box.append(l, v);
    figures.append(box);
  };
  add(text.stats.played, String(st.played.length));
  add(text.stats.perfect, String(st.perfect));
  section.append(figures);

  const gaps = optimumGaps(st.played);
  const hist = el("section", "stats-hist");
  const hh = el("h2");
  hh.textContent = text.stats.gapTitle;
  hist.append(
    hh,
    renderHistogram(
      GAP_BUCKETS.map((label, i) => {
        const count = gaps[i] ?? 0;
        return { label, count, title: text.stats.gapBar(label, count) };
      }),
      { x: text.stats.gapX, y: text.stats.gapY },
    ),
  );
  section.append(hist);

  if (st.played.length === 0) {
    const p = el("p");
    p.textContent = text.stats.empty;
    section.append(p);
  } else {
    const box = el("section", "stats-table");
    const table = el("table");
    const head = el("tr");
    for (const h of [text.stats.date, text.stats.score, text.stats.optimum]) {
      const th = el("th");
      th.scope = "col";
      th.textContent = h;
      head.append(th);
    }
    const thead = el("thead");
    thead.append(head);
    const tbody = el("tbody");
    for (const p of [...st.played].reverse()) {
      const tr = el("tr");
      const date = el("td");
      date.append(link({ href: `/${p.date}`, label: p.date }));
      const score = el("td");
      score.textContent = String(p.score);
      const opt = el("td");
      opt.textContent = p.optimum !== undefined ? String(p.optimum) : "–";
      tr.append(date, score, opt);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    box.append(table);
    section.append(box);
  }
  const actions = el("div", "controls");
  actions.append(link({ href: "/", label: text.stats.playLatest }, "btn primary"));
  section.append(actions);
  main.replaceChildren(section);
  return { title: text.stats.title };
}
