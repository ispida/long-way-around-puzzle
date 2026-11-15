/**
 * The leaderboard pop-up: a small modal with a one-line title, a close button and a histogram of
 * scores. Esc, the × and a click on the backdrop close it (<dialog> handles Esc and the focus).
 */
import { renderHistogram, type Bar } from "./histogram";
import { el } from "./layout";
import { text } from "./text";

export interface LeaderboardDialog {
  /** Fills the pop-up with new bars (and a one-line note under them) and opens it. */
  open(bars: readonly Bar[], note?: string): void;
  close(): void;
  element: HTMLDialogElement;
}

export function leaderboardDialog(title: string, axis: { x: string; y?: string }): LeaderboardDialog {
  const dialog = el("dialog", "leaderboard");
  const id = `leaderboard-${Math.random().toString(36).slice(2, 8)}`;
  dialog.setAttribute("aria-labelledby", id);
  const head = el("div", "leaderboard-head");
  const h = el("h2");
  h.id = id;
  h.textContent = title;
  const close = el("button", "close");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", text.leaderboard.close);
  close.addEventListener("click", () => dialog.close());
  head.append(h, close);
  const body = el("div", "leaderboard-body");
  dialog.append(head, body);
  // A click on the backdrop lands on the <dialog> itself, outside its content box.
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });

  return {
    element: dialog,
    open(bars, note) {
      if (bars.length === 0) {
        const p = el("p", "muted");
        p.textContent = text.leaderboard.empty;
        body.replaceChildren(p);
      } else body.replaceChildren(renderHistogram(bars, axis));
      if (note) {
        const p = el("p", "leaderboard-note");
        p.textContent = note;
        body.append(p);
      }
      if (!dialog.open) dialog.showModal();
      close.focus();
    },
    close: () => dialog.close(),
  };
}
