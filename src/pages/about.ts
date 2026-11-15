/** /about: what the game is. */
import { el } from "@ui/layout";
import { text } from "@ui/text";
import type { PageContext, PageResult } from "./context";

interface Section {
  heading: string;
  /** Paragraphs; a string array renders as a bullet list. */
  body: (string | string[])[];
}

function prose(main: HTMLElement, eyebrow: string, title: string, lead: string, sections: Section[]) {
  const section = el("section", "page prose");
  const eb = el("span", "eyebrow");
  eb.textContent = eyebrow;
  const h1 = el("h1");
  h1.textContent = title;
  const p = el("p", "lead");
  p.textContent = lead;
  section.append(eb, h1, p);
  for (const s of sections) {
    const h2 = el("h2");
    h2.textContent = s.heading;
    section.append(h2);
    for (const b of s.body) {
      if (typeof b === "string") {
        const para = el("p");
        para.textContent = b;
        section.append(para);
      } else {
        const ul = el("ul");
        for (const item of b) {
          const li = el("li");
          li.textContent = item;
          ul.append(li);
        }
        section.append(ul);
      }
    }
  }
  main.replaceChildren(section);
}

const titled = (title: string): PageResult => ({ title: `${title} · ${text.siteName}` });

export function aboutPage(main: HTMLElement, ctx: PageContext): PageResult {
  prose(main, text.siteName, "About", ctx.theme.text(text.tagline), [
    {
      heading: "The game",
      body: [
        ctx.theme.text(
          "Long Way Around is a small puzzle game. Place {pieces} so the {animal} has to take the longest possible walk to the {food|lower}. Every level has a proven best answer, so you always know how close you got.",
        ),
        "It is inspired by enclose.horse.",
      ],
    },
    {
      heading: "No tracking",
      body: [
        "No account, no cookies, no ads, no server. Your progress stays in your browser's local storage and never leaves your device.",
      ],
    },
  ]);
  return titled("About");
}
