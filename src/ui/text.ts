/** All user-facing UI strings (English only). Game words like {animal} come from the theme. */
export const text = {
  siteName: "Long Way Around",
  tagline:
    "The {animal} always takes the way to the {food} that saves the least: usually the shortest one. Every step it walks gives the {guardians} time to save more. Make it walk the long way.",
  /** Story score: same number as the engine score, read as food saved. Pick a form with `plural()`. */
  score: {
    saved: { one: "{n} {unit} saved", other: "{n} {units} saved" },
  },
  /** Story status lines. Trapped explains the engine's cut-off rule (score 0). */
  status: {
    trapped: "Trapped! The {animal} smashes through and eats everything. Nothing saved.",
    walking: "The {guardians} are saving {food|lower}…",
  },
  nav: {
    daily: "Dailies",
    campaign: "Campaign",
    rules: "How to play",
    stats: "My stats",
  },
  footer: {
    about: "About",
  },
  theme: { label: "Choose bear" },
  comingSoon: "Coming soon",
  notFound: {
    title: "Not found",
    lead: "This path leads nowhere. Even the {animal} would turn around.",
    back: "Back to the start",
  },
  play: {
    /** Labels of the counters above the board: "Score: 12", "Logs: 1/3". */
    score: "Score",
    pieces: "{pieces|cap}",
    piecesLeft: { one: "{n} {piece|lower} left.", other: "{n} {pieces} left." },
    /** What the animal says when a hedge would cut it off (one picked at random, never twice in a row). */
    blocked: [
      "I need my {food}!",
      "Don't block my path!",
      "Hey! I have to get through!",
      "Leave me a way out!",
      "That's my last way to the {food}!",
      "I'd smash right through that!",
      "Not that one, please!",
      "My tummy is rumbling…",
      "Detours yes, walls no!",
      "Make me walk far, but not forever!",
      "I can smell the {food} from here!",
      "One little gap, that's all I ask.",
    ],
    submit: "Submit",
    /** The Submit button after the one submission of a level. */
    submitted: "Submitted",
    walking: "Walking…",
    clear: "Clear",
    /** Restores the best layout tried so far on this level. */
    toBest: (score: number) => `Best: ${score}`,
    hint: "Click a grass tile to place a {piece|lower}, click again to remove it. The dotted line is the route the {animal} will take; every step saves one more {unit}. Keyboard: arrow keys and Space. A {piece|lower} that would trap the {animal} is refused.",
    budgetFull: "No {pieces} left. Remove one first.",
    notAllowed: "You can only place a {piece|lower} on grass.",
    /** `trapped` is the filled status.trapped line when the animal has no way left, else null. */
    boardLabel: (w: number, h: number, steps: number, trapped: string | null) =>
      `Puzzle board, ${w} by ${h} tiles. ${trapped ?? `The current route is ${steps} steps long.`}`,
    noStorage: "Your browser blocks storage, so results are not remembered after you leave.",
  },
  result: {
    yourScore: "Your score",
    optimum: "Optimal",
    showOptimal: "Show optimal layout",
    hideOptimal: "Hide optimal layout",
    /** For a stored solution the solver could not prove optimal in time. */
    bestKnown: "Best known",
    showBestKnown: "Show best known layout",
    hideBestKnown: "Hide best known layout",
    toCampaign: "Back to the campaign",
  },
  daily: {
    previous: "← Previous",
    next: "Next →",
    nextTitle: "This is the latest daily",
    noneTitle: "No daily on this day",
    none: "There is no puzzle for this date.",
    latest: "Play the latest daily",
    toCampaign: "Play the campaign",
  },
  stats: {
    title: "My stats",
    lead: "Your dailies, stored only in this browser.",
    /** The histogram of how far each counted daily was from the optimum. */
    gapTitle: "Distance from the optimum",
    gapX: "Your score minus the optimum",
    gapY: "Dailies",
    gapBar: (label: string, n: number) => `${label}: ${n} ${n === 1 ? "daily" : "dailies"}`,
    played: "Dailies played",
    perfect: "Optimum reached",
    empty: "You haven't played a daily yet.",
    playLatest: "Play the latest daily",
    date: "Date",
    score: "Counted",
    optimum: "Optimum",
  },
  levelNav: {
    previous: "← Previous level",
    next: "Next level →",
    nextLocked: "Submit this level to unlock the next one",
  },
  /** The first-visit pop-up. `lead` is split around the emphasised words. */
  intro: {
    title: "How to play",
    lead: [
      "The {animal} wants to reach the {food|lower} fast. To save as much as possible, make him go ",
      "the long way around",
      ".",
    ],
    aim: "The aim of the game is to have the {animal} walk the longest route possible.",
    steps: [
      "Place {pieces} to make his way longer.",
      "Do not enclose the {animal}.",
      "Try making the {animal} switch direction to gain more points.",
      "Enjoy playing!",
    ],
    ok: "Let's go",
  },
  /** The scores pop-up: this browser's score on this level. */
  leaderboard: {
    title: "Your score",
    close: "Close",
    reopen: "Show your score",
    xAxis: "Score",
    bar: (range: string, n: number) => `Score ${range}: ${n} ${n === 1 ? "player" : "players"}`,
    local: "Scores stay in this browser.",
    empty: "No scores yet.",
  },
  campaign: {
    title: "Campaign",
    locked: "Locked",
    coming: "Coming soon",
    notPlayed: "Not played",
    lockedLevel: "This level is still locked. Submit the previous level first.",
    unknownLevel: "This level doesn't exist yet.",
  },
  rules: {
    title: "How to play",
    coreTitle: "Rules",
  },
} as const;
