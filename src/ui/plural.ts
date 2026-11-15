/** Singular/plural choice for counted texts like "1 jar saved" / "41 jars saved". */
import { text } from "./text";

export interface PluralForms {
  one: string;
  other: string;
}

/** English plural rule: exactly 1 is singular, everything else (0, 2, 41) plural. */
export function plural(n: number, forms: PluralForms): string {
  return n === 1 ? forms.one : forms.other;
}

/** Picks the form for `n`, fills {n}, then lets `fill` (a theme's text()) fill the word placeholders. */
export function countText(n: number, forms: PluralForms, fill: (t: string) => string): string {
  return fill(plural(n, forms).replaceAll("{n}", String(n)));
}

/** "41 jars saved" / "1 jar saved". */
export function savedText(n: number, fill: (t: string) => string): string {
  return countText(n, text.score.saved, fill);
}
