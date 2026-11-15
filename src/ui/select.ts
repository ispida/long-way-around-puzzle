/** Pickers: a labelled dropdown and a menu button (the header's "Choose bear"). */
import { el } from "./layout";

export function dropdown(
  label: string,
  options: readonly { id: string; name: string }[],
  selected: string,
  onChange: (id: string) => void,
): HTMLElement {
  const wrap = el("label", "picker");
  const span = el("span");
  span.textContent = label;
  const select = el("select");
  for (const o of options) {
    const opt = el("option");
    opt.value = o.id;
    opt.textContent = o.name;
    opt.selected = o.id === selected;
    select.append(opt);
  }
  select.addEventListener("change", () => onChange(select.value));
  wrap.append(span, select);
  return wrap;
}

/**
 * A button that opens a small menu below it (the header's "Choose bear"). Picking an entry applies it
 * and closes the menu; a click outside or Esc closes it too. The current entry carries a checkmark.
 */
export function menuButton(
  label: string,
  options: readonly { id: string; name: string }[],
  selected: string,
  onChange: (id: string) => void,
): HTMLElement {
  const wrap = el("div", "picker-menu");
  const button = el("button", "picker-button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  const menu = el("ul", "picker-list");
  menu.id = `menu-${Math.random().toString(36).slice(2, 8)}`;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", label);
  button.setAttribute("aria-controls", menu.id);
  menu.hidden = true;
  let current = selected;

  const items = options.map((o) => {
    const li = el("li");
    li.setAttribute("role", "none");
    const item = el("button");
    item.type = "button";
    item.setAttribute("role", "menuitemradio");
    item.dataset.id = o.id;
    item.textContent = o.name;
    item.addEventListener("click", () => {
      current = o.id;
      mark();
      close(true);
      onChange(o.id);
    });
    li.append(item);
    menu.append(li);
    return item;
  });
  const mark = () => {
    for (const i of items) i.setAttribute("aria-checked", String(i.dataset.id === current));
  };
  mark();

  const onDocDown = (e: PointerEvent) => {
    if (!wrap.contains(e.target as Node)) close(false);
  };
  function open(): void {
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", onDocDown);
    (items.find((i) => i.dataset.id === current) ?? items[0])?.focus();
  }
  function close(refocus: boolean): void {
    if (menu.hidden) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", onDocDown);
    if (refocus) button.focus();
  }

  button.addEventListener("click", () => (menu.hidden ? open() : close(false)));
  wrap.addEventListener("keydown", (e) => {
    if (menu.hidden) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (step !== 0) {
      e.preventDefault();
      items[(at + step + items.length) % items.length]?.focus();
    }
  });
  // Close when focus moves to something outside (Tab). Safari doesn't focus a tapped button, so a tap
  // on an entry blurs the focused one with no target: closing then would hide the menu before the tap
  // lands. Taps and clicks outside are handled by the pointerdown listener.
  wrap.addEventListener("focusout", (e) => {
    const to = e.relatedTarget as Node | null;
    if (to && !wrap.contains(to)) close(false);
  });
  wrap.append(button, menu);
  return wrap;
}
