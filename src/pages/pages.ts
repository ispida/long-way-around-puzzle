/** Simple pages; the campaign, level and rules pages have their own modules. */
import { text } from "@ui/text";
import type { PageContext, PageResult } from "./context";
import { placeholderPage } from "./placeholder";

const titled = (title: string): PageResult => ({ title });

export function playSharedPage(main: HTMLElement): PageResult {
  placeholderPage(main, {
    eyebrow: "Shared level",
    title: "Play a shared level",
    lead: "Levels shared by link open here.",
  });
  return titled("Shared level");
}

export function notFoundPage(main: HTMLElement, ctx: PageContext): PageResult {
  placeholderPage(main, {
    eyebrow: "404",
    title: text.notFound.title,
    lead: ctx.theme.text(text.notFound.lead),
    badge: "404",
    back: true,
  });
  return titled(text.notFound.title);
}
