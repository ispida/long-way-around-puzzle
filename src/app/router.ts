/** Client-side navigation for the public app: link interception, history, page rendering. */
import type { PageContext, PageResult } from "@pages/context";
import { campaignPage } from "@pages/campaign";
import { dailyPage } from "@pages/daily";
import { levelPage } from "@pages/level";
import { aboutPage } from "@pages/about";
import * as pages from "@pages/pages";
import { rulesPage } from "@pages/rules";
import { statsPage } from "@pages/stats";
import type { Theme } from "@themes/theme";
import type { Shell } from "@ui/layout";
import { matchRoute } from "./routes";

export interface Router {
  /** Applies a new theme to the current page (or re-renders it). */
  setTheme(theme: Theme): void;
}

export function startRouter(shell: Shell, ctx: PageContext): Router {
  let current: PageResult | undefined;
  let token = 0;
  const latest = `/${ctx.dailyDates.at(-1) ?? ""}`;

  async function render(pathname: string): Promise<void> {
    const mine = ++token;
    current?.cleanup?.();
    current = undefined;
    let route = matchRoute(pathname);
    if (route.name === "home") {
      // "/" opens the latest daily; no extra history entry.
      pathname = latest;
      history.replaceState(null, "", pathname);
      route = matchRoute(pathname);
    }
    const { main } = shell;
    let result: PageResult;
    switch (route.name) {
      case "home": // replaced above
      case "daily":
        result = await dailyPage(main, ctx, route.name === "daily" ? route.date : latest.slice(1));
        break;
      case "campaign":
        result = campaignPage(main, ctx);
        break;
      case "level":
        result = await levelPage(main, ctx, route.n);
        break;
      case "play":
        result = pages.playSharedPage(main);
        break;
      case "stats":
        result = statsPage(main, ctx);
        break;
      case "rules":
        result = rulesPage(main, ctx);
        break;
      case "about":
        result = aboutPage(main, ctx);
        break;
      case "not-found":
        result = pages.notFoundPage(main, ctx);
        break;
    }
    if (mine !== token) {
      result.cleanup?.(); // a newer navigation started while this page was loading
      return;
    }
    current = result;
    document.title = result.title.includes("Long Way Around")
      ? result.title
      : `${result.title} · Long Way Around`;
    // "Dailies" links to "/", which shows the latest daily.
    shell.setCurrent(pathname === latest ? "/" : pathname);
  }

  const go = (pathname: string, push: boolean) => {
    if (push) history.pushState(null, "", pathname);
    void render(pathname);
    window.scrollTo(0, 0);
  };

  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest("a");
    if (!a || a.target || a.hasAttribute("download")) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    const target = url.pathname === "/" ? latest : url.pathname;
    if (target !== location.pathname) go(target, true);
  });
  window.addEventListener("popstate", () => go(location.pathname, false));

  void render(location.pathname);

  return {
    setTheme(theme) {
      ctx.theme = theme;
      if (current?.onTheme) current.onTheme(theme);
      else void render(location.pathname);
    },
  };
}
