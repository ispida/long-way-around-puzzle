/** Placeholder content for routes whose real page arrives in a later phase. */
import { el, link } from "@ui/layout";
import { text } from "@ui/text";

export interface PlaceholderOptions {
  eyebrow: string;
  title: string;
  lead: string;
  badge?: string;
  back?: boolean;
}

export function placeholderPage(main: HTMLElement, o: PlaceholderOptions): void {
  const section = el("section", "page");
  const eyebrow = el("span", "eyebrow");
  eyebrow.textContent = o.eyebrow;
  const h1 = el("h1");
  h1.textContent = o.title;
  const lead = el("p", "lead");
  lead.textContent = o.lead;
  const badge = el("span", "badge");
  badge.textContent = o.badge ?? text.comingSoon;
  section.append(eyebrow, h1, lead, badge);
  if (o.back) section.append(link({ href: "/", label: text.notFound.back }));
  main.replaceChildren(section);
}
