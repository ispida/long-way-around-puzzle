/**
 * The play screen:
 * "Score: 12" and the pieces counter above a large centred board, Submit and Clear below. One Submit per
 * level; after it the optimum and "Show optimal layout" join the buttons and the scores pop up. The board
 * stays editable for trying things out. A piece that would trap the animal is refused, and it protests in
 * a speech bubble.
 */
import {
  budgetLeft,
  countPieces,
  decodeSolution,
  isValidPlacement,
  route,
  score,
  togglePlacement,
  type Board,
  type Placements,
  type RouteResult,
} from "@engine/index";
import { playWalk, timeline } from "@render/animate";
import { cellSize, MIN_CELL, prepareCanvas } from "@render/canvas";
import { cellAt } from "@render/hit";
import { drawScene } from "@render/layers";
import { centre } from "@render/route-line";
import type { Layout, Store, Submission } from "@storage/store";
import type { Theme } from "@themes/theme";
import { el } from "@ui/layout";
import { leaderboardDialog } from "@ui/leaderboard";
import { countText, savedText } from "@ui/plural";
import { text } from "@ui/text";
import { localCounts, scoreBars } from "./leaderboard-data";
import { nextPhase, type Phase } from "./phase";
import { createSpeech } from "./speech";

export interface PlayOptions {
  board: Board;
  theme: Theme;
  store: Store;
  levelId: string;
  /** Placement shown at start (the submitted one); without it the best layout tried so far. */
  initial?: Placements;
  /** Called after the submission is saved (e.g. to unlock the "Next level" button). */
  onSubmitted?: () => void;
}

export interface PlayHandle {
  setTheme(theme: Theme): void;
  destroy(): void;
}

const HEDGE = "hedge";

export function mountPlay(root: HTMLElement, o: PlayOptions): PlayHandle {
  const { board, store, levelId } = o;
  let theme = o.theme;
  /** The best layout tried so far on this level (kept in the store), if it still fits the level. */
  let best: Layout | undefined = usable(board, store.level(levelId).bestTry);
  let placements: Placements = new Map(o.initial ?? best?.placements ?? []);
  let phase: Phase = "placing";
  let current: RouteResult = route(board, placements);
  let hover: number | null = null;
  let cursor: number | null = null;
  /** The optimal layout while "Show optimal layout" is on: shown instead of the player's own. */
  let optimal: { placements: Placements; route: RouteResult } | undefined;
  let walkView:
    { upto: number; animalAt: [number, number]; score: number; facing: 1 | -1; stride: number } | undefined;
  let cell = 40;
  let ctx: CanvasRenderingContext2D | undefined;
  const walkAbort = new AbortController();
  const solution = board.level.solution ?? undefined;
  const startScore = score(board, route(board));
  /** One Submit per level: once there is a counted submission the button stays off. */
  let submitted: Submission | undefined = store.level(levelId).counted;
  const budget = board.budgets[board.pieceIds.indexOf(HEDGE)] ?? 0;
  const say = createSpeech(text.play.blocked);
  let speechTimer: ReturnType<typeof setTimeout> | undefined;

  /* ---------- DOM ---------- */
  const wrap = el("div", "play");

  const hud = el("div", "hud");
  const scoreStat = pill(text.play.score, "score");
  const hedgeStat = pill("", "hedges");
  hud.append(scoreStat.box, hedgeStat.box);

  const frame = el("div", "board-frame");
  const canvas = el("canvas");
  canvas.tabIndex = 0;
  canvas.id = `board-${levelId}`;
  canvas.dataset.w = String(board.w);
  canvas.dataset.h = String(board.h);
  const bubble = el("div", "speech");
  bubble.hidden = true;
  bubble.setAttribute("aria-hidden", "true"); // the same text goes to the live region
  frame.append(canvas, bubble);

  const controls = el("div", "controls center");
  const submitBtn = el("button", "btn small primary");
  submitBtn.type = "button";
  submitBtn.textContent = text.play.submit;
  const clearBtn = el("button", "btn small");
  clearBtn.type = "button";
  clearBtn.textContent = text.play.clear;
  // Back to the best layout tried so far, after clearing or changing the board.
  // Always there (off until something beats the start), so Submit and Clear never move under a finger.
  const bestBtn = el("button", "btn small best");
  bestBtn.type = "button";
  bestBtn.addEventListener("click", () => {
    if (!best || phase === "walking") return;
    if (phase === "result") phase = nextPhase(phase, "edit");
    placements = new Map(best.placements);
    optimal = undefined;
    current = route(board, placements);
    draw();
    announce(savedText(score(board, current), theme.text));
  });
  // After the one Submit: the optimum and its layout, next to Clear.
  const optimum = pill(solution?.proven === false ? text.result.bestKnown : text.result.optimum, "optimum");
  const optBtn = el("button", "btn small");
  optBtn.type = "button";
  const [showOpt, hideOpt] =
    solution?.proven === false
      ? [text.result.showBestKnown, text.result.hideBestKnown]
      : [text.result.showOptimal, text.result.hideOptimal];
  optBtn.addEventListener("click", () => {
    if (!solution) return;
    if (optimal) optimal = undefined;
    else {
      const best = decodeSolution(board, solution.data);
      optimal = { placements: best, route: route(board, best) };
    }
    draw();
  });
  controls.append(submitBtn, clearBtn, bestBtn, optimum.box, optBtn);
  // "The bees are saving honey…" while the animal walks.
  const walkLine = el("p", "walk-line");

  // Instructions for screen readers only; the board itself is self-explanatory.
  const hint = el("p", "sr-only");
  hint.id = `hint-${levelId}`;
  canvas.setAttribute("aria-describedby", hint.id);
  const live = el("p", "sr-only");
  live.setAttribute("aria-live", "polite");

  // No "Players" label: the counts on the bars say it.
  const scoreboard = leaderboardDialog(text.leaderboard.title, { x: text.leaderboard.xAxis });
  wrap.append(hud, frame, controls, walkLine, hint, live, scoreboard.element);
  if (!store.persistent) {
    const warn = el("p", "hint warn");
    warn.textContent = text.play.noStorage;
    wrap.append(warn);
  }
  root.replaceChildren(wrap);

  /* ---------- drawing ---------- */
  /** Board as large as fits: limited by the column width and by the window height (buttons stay visible). */
  function layout(): void {
    // The frame's padding is smaller on phones (game.css), so read it.
    const pad = parseFloat(getComputedStyle(frame).paddingLeft) || 0;
    const width = wrap.clientWidth - 2 * pad;
    const byWidth = cellSize(width > 0 ? width : 600, board.w);
    // Space from the top of the board to the window bottom, minus everything below the board (buttons,
    // page padding, footer), so the whole page fits the window without scrolling.
    const rect = frame.getBoundingClientRect();
    const boardTop = rect.top + window.scrollY + pad;
    const below = wrap.getBoundingClientRect().bottom - rect.bottom + pad + pageBelow(wrap);
    const byHeight = Math.floor((window.innerHeight - boardTop - below) / board.h);
    const next = Math.max(MIN_CELL, Math.min(byWidth, byHeight));
    if (!ctx || next !== cell) {
      cell = next;
      ctx = prepareCanvas(canvas, board.w, board.h, cell);
      canvas.style.width = `${board.w * cell}px`;
    }
    draw();
  }

  function draw(): void {
    if (!ctx) return;
    const open = current.open;
    drawScene(ctx, {
      board,
      theme,
      cell,
      placements: optimal?.placements ?? placements,
      route: optimal?.route ?? current,
      upto: walkView?.upto,
      animalAt: walkView?.animalAt,
      walking: walkView ? { facing: walkView.facing, stride: walkView.stride } : undefined,
      hover: phase !== "walking" && !optimal && hover !== null ? { cell: hover, ok: canToggle(hover) } : null,
      cursor: phase !== "walking" && !optimal ? cursor : null,
      cutOff: !open,
    });
    canvas.dataset.showing = optimal ? "optimal" : "own"; // the canvas can't be inspected; e2e reads this
    const value = walkView ? walkView.score : score(board, optimal?.route ?? current);
    scoreStat.value.textContent = String(value);
    hedgeStat.label.textContent = theme.text(text.play.pieces);
    hedgeStat.value.textContent = `${countPieces(optimal?.placements ?? placements, HEDGE)}/${budget}`;
    walkLine.textContent = theme.text(text.status.walking);
    walkLine.classList.toggle("on", phase === "walking");
    submitBtn.disabled = phase === "walking" || !open || submitted !== undefined;
    submitBtn.textContent =
      phase === "walking" ? text.play.walking : submitted ? text.play.submitted : text.play.submit;
    const showOptimum = submitted !== undefined && solution !== undefined && phase !== "walking";
    optimum.box.hidden = !showOptimum;
    optBtn.hidden = !showOptimum;
    if (solution) optimum.value.textContent = String(solution.score);
    optBtn.textContent = optimal ? hideOpt : showOpt;
    if (submitted && !scoreStat.box.hasAttribute("role")) {
      scoreStat.box.setAttribute("role", "button");
      scoreStat.box.tabIndex = 0;
      scoreStat.box.title = text.leaderboard.reopen;
      scoreStat.box.classList.add("clickable");
    }
    clearBtn.disabled = phase === "walking" || (placements.size === 0 && !optimal);
    // Only a layout that beats the empty board is worth going back to.
    const worth = best !== undefined && best.score > startScore;
    bestBtn.textContent = text.play.toBest(worth ? best!.score : startScore);
    bestBtn.disabled = phase === "walking" || !worth || sameLayout(best!, placements);
    hint.textContent = theme.text(text.play.hint);
    canvas.setAttribute(
      "aria-label",
      text.play.boardLabel(board.w, board.h, current.steps, open ? null : theme.text(text.status.trapped)),
    );
  }

  const canToggle = (c: number) =>
    placements.get(c) === HEDGE || togglePlacement(board, placements, c, HEDGE).ok;

  /* ---------- input ---------- */
  function toggle(c: number): void {
    if (phase === "walking") return;
    if (optimal) {
      // A tap on the board while the optimal layout shows goes back to the player's own.
      optimal = undefined;
      draw();
      return;
    }
    const r = togglePlacement(board, placements, c, HEDGE);
    if (!r.ok) {
      announce(theme.text(r.reason === "no-budget" ? text.play.budgetFull : text.play.notAllowed));
      if (r.reason === "no-budget") shake(hedgeStat.box);
      return;
    }
    const next = route(board, r.placements);
    if (!next.open) {
      // Never let the player seal the animal in: refuse the hedge and let the animal protest.
      speak(theme.text(say()));
      return;
    }
    if (phase === "result") phase = nextPhase(phase, "edit");
    placements = r.placements;
    optimal = undefined;
    current = next;
    remember();
    draw();
    announce(
      `${savedText(score(board, current), theme.text)}. ${countText(budgetLeft(board, placements, HEDGE), text.play.piecesLeft, theme.text)}`,
    );
  }

  /** Keeps the current layout as the best so far if it scores more (also across visits). */
  function remember(): void {
    const s = score(board, current);
    if (placements.size === 0 || (best && best.score >= s)) return;
    best = { score: s, placements: [...placements].sort((a, b) => a[0] - b[0]) };
    store.tried(levelId, best);
  }

  /** Shows a speech bubble above the animal for a moment. */
  function speak(line: string): void {
    bubble.textContent = line;
    bubble.hidden = false;
    announce(line);
    const rect = canvas.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const x = board.start % board.w;
    const y = Math.floor(board.start / board.w);
    const ax = rect.left - frameRect.left + ((x + 0.5) / board.w) * rect.width;
    const ay = rect.top - frameRect.top + (y / board.h) * rect.height;
    const width = bubble.offsetWidth;
    const left = Math.max(4, Math.min(frameRect.width - width - 4, ax - width / 2));
    bubble.style.left = `${left}px`;
    bubble.style.top = `${ay - 6}px`;
    bubble.style.setProperty("--tail", `${ax - left}px`);
    bubble.classList.remove("pop");
    void bubble.offsetWidth; // restart the pop animation
    bubble.classList.add("pop");
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => (bubble.hidden = true), 2600);
  }

  canvas.addEventListener("pointermove", (e) => {
    const c = cellAt(canvas.getBoundingClientRect(), e.clientX, e.clientY, board.w, board.h);
    if (c !== hover) {
      hover = c;
      draw();
    }
  });
  canvas.addEventListener("pointerleave", () => {
    hover = null;
    draw();
  });
  canvas.addEventListener("click", (e) => {
    const c = cellAt(canvas.getBoundingClientRect(), e.clientX, e.clientY, board.w, board.h);
    if (c !== null) toggle(c);
  });
  canvas.addEventListener("focus", () => {
    // Show the keyboard cursor only for keyboard focus, not after a mouse click.
    if (cursor === null && canvas.matches(":focus-visible")) cursor = board.start;
    draw();
  });
  canvas.addEventListener("blur", () => {
    cursor = null;
    draw();
  });
  canvas.addEventListener("keydown", (e) => {
    if (phase === "walking") return;
    if (e.key === "Escape") {
      bubble.hidden = true;
      return;
    }
    if (cursor === null) {
      // First key after a mouse focus: show the cursor before moving it.
      if (e.key.startsWith("Arrow") || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        cursor = board.start;
        draw();
      }
      return;
    }
    const c = cursor;
    const x = c % board.w;
    const y = Math.floor(c / board.w);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    };
    const m = moves[e.key];
    if (m) {
      const nx = Math.min(board.w - 1, Math.max(0, x + m[0]));
      const ny = Math.min(board.h - 1, Math.max(0, y + m[1]));
      cursor = ny * board.w + nx;
      e.preventDefault();
      draw();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle(c);
    }
  });

  clearBtn.addEventListener("click", () => {
    if (phase === "result") phase = nextPhase(phase, "edit");
    placements = new Map();
    optimal = undefined;
    current = route(board, placements);
    draw();
  });

  submitBtn.addEventListener("click", () => void submit());

  /* ---------- submit ---------- */
  async function submit(): Promise<void> {
    const next = nextPhase(phase, "submit", current.open);
    if (next !== "walking") return;
    phase = next;
    hover = null;
    optimal = undefined;
    bubble.hidden = true;
    draw();

    const r = current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const t = timeline(board, r);
      await playWalk(
        t,
        (f) => {
          const a = r.path[f.k];
          const b = r.path[Math.min(f.k + 1, r.path.length - 1)];
          if (!a || !b) return;
          const [ax, ay] = centre(board, a.cell, cell);
          const [bx, by] = centre(board, b.cell, cell);
          walkView = {
            upto: f.k,
            animalAt: [ax + (bx - ax) * f.frac, ay + (by - ay) * f.frac],
            // Face the way it walks; going straight up or down keeps the last direction.
            facing: bx < ax ? -1 : bx > ax ? 1 : (walkView?.facing ?? 1),
            // Two frame changes per step: slower on mud, as the walk itself is.
            stride: Math.floor((f.k + f.frac) * 2),
            score: f.score,
          };
          draw();
        },
        walkAbort.signal,
      );
      if (walkAbort.signal.aborted) return;
    }
    walkView = undefined;

    const submission: Submission = {
      score: score(board, r),
      steps: r.steps,
      bonus: r.bonus,
      placements: [...placements].sort((a, b) => a[0] - b[0]),
      at: new Date().toISOString(),
      ...(solution ? { optimum: solution.score } : {}),
    };
    store.submit(levelId, submission);
    submitted = submission;
    phase = nextPhase(phase, "walked");
    draw();
    announce(
      `${text.result.yourScore}: ${savedText(submission.score, theme.text)}.${solution ? ` ${optimum.label.textContent}: ${solution.score}.` : ""}`,
    );
    o.onSubmitted?.();
    showScores("submit");
  }

  /* ---------- scores pop-up ---------- */
  /** Opens the pop-up with this browser's score (there is no server collecting everyone's). */
  function showScores(why: "submit" | "reopen"): void {
    const s = store.level(levelId).counted;
    if (!s || walkAbort.signal.aborted || (why === "reopen" && scoreboard.element.open)) return;
    scoreboard.open(
      scoreBars(localCounts(store.level(levelId)), s.score, (range, n) => text.leaderboard.bar(range, n)),
      text.leaderboard.local,
    );
  }

  // After the Submit the Score pill reopens the pop-up.
  scoreStat.box.addEventListener("click", () => {
    if (submitted) showScores("reopen");
  });
  scoreStat.box.addEventListener("keydown", (e) => {
    if (submitted && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      showScores("reopen");
    }
  });

  /* ---------- helpers ---------- */
  function announce(msg: string): void {
    live.textContent = msg;
  }

  const observer = new ResizeObserver(() => layout());
  observer.observe(wrap);
  const onResize = () => layout();
  window.addEventListener("resize", onResize);
  layout();

  return {
    setTheme(t) {
      theme = t;
      draw();
    },
    destroy() {
      walkAbort.abort();
      scoreboard.close();
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      clearTimeout(speechTimer);
    },
  };
}

/** A compact horizontal counter: "Score: 12", "Logs: 1/3", or just a value without a label. */
function pill(label: string, cls: string): { box: HTMLElement; label: HTMLElement; value: HTMLElement } {
  const box = el("div", `pill ${cls}`.trim());
  const l = el("span", "label");
  l.textContent = label;
  const sep = el("span", "sep");
  sep.textContent = ":";
  sep.setAttribute("aria-hidden", "true");
  const value = el("span", "v");
  if (label || cls === "hedges") box.append(l, sep);
  box.append(value);
  return { box, label: l, value };
}

/** Height below the play area that must also fit in the window: the page's bottom padding and the footer. */
function pageBelow(wrap: HTMLElement): number {
  const main = wrap.closest("main");
  const padBottom = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
  const footer = document.querySelector<HTMLElement>(".site-footer");
  return padBottom + (footer?.offsetHeight ?? 0);
}

function shake(node: HTMLElement): void {
  node.animate?.(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 220 },
  );
}

/** A stored best layout, if it is still valid on this board and leaves the animal a way out. */
function usable(board: Board, layout: Layout | undefined): Layout | undefined {
  if (!layout) return undefined;
  const placements = new Map(layout.placements);
  if (!isValidPlacement(board, placements)) return undefined;
  const r = route(board, placements);
  return r.open ? { score: score(board, r), placements: layout.placements } : undefined;
}

function sameLayout(layout: Layout, placements: Placements): boolean {
  return (
    layout.placements.length === placements.size &&
    layout.placements.every(([c, p]) => placements.get(c) === p)
  );
}
