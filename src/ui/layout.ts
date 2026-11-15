/** Page chrome: header with navigation, main area, footer links. */
import { text } from "./text";

export interface NavLink {
  href: string;
  label: string;
}

export interface Shell {
  main: HTMLElement;
  /** Marks the nav link for `pathname` as current. */
  setCurrent(pathname: string): void;
}

export function renderShell(
  root: HTMLElement,
  nav: NavLink[],
  footer: NavLink[],
  actions?: HTMLElement,
): Shell {
  root.replaceChildren();

  const header = el("header", "site-header");
  const hwrap = el("div", "wrap");
  const brand = link({ href: "/", label: text.siteName }, "brand");
  const navEl = el("nav", "site-nav");
  navEl.setAttribute("aria-label", "Main");
  const navLinks = nav.map((n) => link(n));
  navEl.append(...navLinks);
  hwrap.append(brand, navEl);
  if (actions) hwrap.append(actions);
  header.append(hwrap);

  const main = el("main", "wrap");
  main.id = "main";

  const foot = el("footer", "site-footer");
  const fwrap = el("div", "wrap");
  fwrap.append(...footer.map((f) => link(f)));
  foot.append(fwrap);

  root.append(header, main, foot);

  return {
    main,
    setCurrent(pathname) {
      for (const a of navLinks) {
        if (a.getAttribute("href") === pathname) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      }
    },
  };
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

export function link(n: NavLink, className?: string): HTMLAnchorElement {
  const a = el("a", className);
  a.href = n.href;
  a.textContent = n.label;
  return a;
}
