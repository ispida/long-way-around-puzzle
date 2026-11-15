/**
 * The first-visit "How to play" pop-up: a short explanation in the theme's words and one button. It
 * looks like the leaderboard pop-up; Esc, the × and a click on the backdrop close it too.
 */
import { el } from "./layout";
import { text } from "./text";

export function introDialog(words: (t: string) => string): HTMLDialogElement {
  const dialog = el("dialog", "leaderboard intro");
  const id = "intro-title";
  dialog.setAttribute("aria-labelledby", id);
  const head = el("div", "leaderboard-head");
  const h = el("h2");
  h.id = id;
  h.textContent = text.intro.title;
  const close = el("button", "close");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", text.leaderboard.close);
  close.addEventListener("click", () => dialog.close());
  head.append(h, close);

  const [before, em, after] = text.intro.lead;
  const lead = el("p");
  const strong = el("em");
  strong.textContent = words(em ?? "");
  lead.append(words(before ?? ""), strong, words(after ?? ""));
  const aim = el("p");
  aim.textContent = words(text.intro.aim);
  const steps = el("ol");
  for (const s of text.intro.steps) {
    const li = el("li");
    li.textContent = words(s);
    steps.append(li);
  }
  const ok = el("button", "btn primary");
  ok.type = "button";
  ok.textContent = text.intro.ok;
  ok.autofocus = true; // the dialog focuses this first, not the ×
  ok.addEventListener("click", () => dialog.close());
  const actions = el("div", "controls center");
  actions.append(ok);

  dialog.append(head, lead, aim, steps, actions);
  dialog.addEventListener("click", (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });
  return dialog;
}
