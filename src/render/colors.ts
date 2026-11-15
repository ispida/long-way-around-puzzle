/** Fixed colours of the game world (same in light and dark UI), overridable by theme palette keys. */
export const COLORS = {
  path: "#7a3e05",
  pathTunnel: "#7a5cc9",
  /** Burrow pair rings: purple, orange, teal, magenta, olive (distinguishable with colour-blindness). */
  rings: ["#7a5cc9", "#d06a2b", "#2b8fa8", "#b83b8f", "#6b7a1f"],
  badge: "#b8402b",
  badgeText: "#ffffff",
  ghost: "#ffd25e",
  hoverOk: "rgba(255,255,255,0.9)",
  hoverBad: "rgba(184,64,43,0.9)",
  cursor: "#ffd25e",
  cutOff: "rgba(184,64,43,0.2)",
  missing: "#c9c9c9",
} as const;

export const pick = (
  palette: Readonly<Record<string, string>>,
  key: keyof typeof COLORS,
  fallback: string,
): string => palette[key] ?? fallback;
