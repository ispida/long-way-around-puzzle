/** URL table. Pure, so it is unit-tested without a browser. */
import { isIsoDate } from "@shared/dates";

export const CAMPAIGN_SIZE = 20;

export type Route =
  | { name: "home" }
  | { name: "daily"; date: string }
  | { name: "campaign" }
  | { name: "level"; n: number }
  | { name: "play" }
  | { name: "stats" }
  | { name: "rules" }
  | { name: "about" }
  | { name: "not-found"; path: string };

const STATIC: Record<string, Route> = {
  "/": { name: "home" },
  "/campaign": { name: "campaign" },
  "/play": { name: "play" },
  "/stats": { name: "stats" },
  "/rules": { name: "rules" },
  "/about": { name: "about" },
};

export function matchRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const fixed = STATIC[path];
  if (fixed) return fixed;

  const level = /^\/campaign\/lvl(\d{1,2})$/.exec(path);
  if (level) {
    const n = Number(level[1]);
    if (n >= 1 && n <= CAMPAIGN_SIZE && String(n) === level[1]) return { name: "level", n };
  }

  const date = path.slice(1);
  if (isIsoDate(date)) return { name: "daily", date };

  return { name: "not-found", path: pathname };
}

/** Canonical path for a route; inverse of matchRoute. */
export function pathOf(route: Route): string {
  switch (route.name) {
    case "home":
      return "/";
    case "daily":
      return `/${route.date}`;
    case "level":
      return `/campaign/lvl${route.n}`;
    case "not-found":
      return route.path;
    default:
      return `/${route.name}`;
  }
}
