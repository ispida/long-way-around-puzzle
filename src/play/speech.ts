/** Picks what the animal says: random, but never the same line twice in a row. */
export function createSpeech(lines: readonly string[], random: () => number = Math.random): () => string {
  let last = -1;
  return () => {
    if (lines.length === 0) return "";
    if (lines.length === 1) return lines[0] ?? "";
    let i = Math.floor(random() * (lines.length - 1));
    if (i >= last && last >= 0) i++; // skip the previous line
    last = i;
    return lines[i] ?? "";
  };
}
