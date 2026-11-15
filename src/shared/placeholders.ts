/**
 * Text placeholders filled from theme words:
 * "{animal}" -> word as is, "{mud|lower}" -> lower case, "{animal|cap}" -> first letter upper case.
 */
const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9]*)(?:\|(lower|cap))?\}/g;

/** Word keys used in a text, in order of first use. */
export function placeholderKeys(text: string): string[] {
  const keys: string[] = [];
  for (const m of text.matchAll(PLACEHOLDER)) {
    const k = m[1] ?? "";
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

/** Fills placeholders; unknown words stay visible as "{key}" so mistakes are easy to spot. */
export function fillWords(text: string, words: Readonly<Record<string, string>>): string {
  return text.replace(PLACEHOLDER, (all, key: string, filter?: string) => {
    const w = words[key];
    if (w === undefined) return all;
    if (filter === "lower") return w.toLowerCase();
    if (filter === "cap") return w.charAt(0).toUpperCase() + w.slice(1);
    return w;
  });
}
