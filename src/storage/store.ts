/**
 * Player data kept only in this browser: settings, and per level the
 * counted (first) submission plus practice attempts. Since 2026-10-07 the
 * play screen allows one Submit per level, so new data has no attempts; old attempts are kept as they are.
 * Every access is wrapped: without storage (private mode, blocked) the game still works, it just forgets.
 */
import { z } from "zod";

export const STORAGE_KEY = "lwr:v1";
/** Set once the first-visit "How to play" pop-up was shown; kept apart from the game data. */
export const INTRO_KEY = "lwr:intro";
const MAX_ATTEMPTS = 50;

const SubmissionSchema = z.object({
  score: z.int(),
  steps: z.int(),
  bonus: z.int(),
  placements: z.array(z.tuple([z.int(), z.string()])),
  at: z.string(),
  /** The level's stored optimum when it was played. */
  optimum: z.int().optional(),
});
const LayoutSchema = z.object({
  score: z.int(),
  placements: z.array(z.tuple([z.int(), z.string()])),
});
const LevelRecordSchema = z.object({
  counted: SubmissionSchema.optional(),
  attempts: z.array(SubmissionSchema).default([]),
  /** The best layout tried so far, submitted or not, so the player can go back to it. */
  bestTry: LayoutSchema.optional(),
});
const DataSchema = z.object({
  v: z.literal(1),
  settings: z
    .object({
      theme: z.string().optional(),
    })
    .default({}),
  levels: z.record(z.string(), LevelRecordSchema).default({}),
  /** The campaign version the lvlNN records belong to; missing = 1. */
  campaignVersion: z.int().optional(),
  /** Campaign progress from older campaign versions, by "campaign-v<N>"; kept, never shown. */
  archive: z.record(z.string(), z.record(z.string(), LevelRecordSchema)).default({}),
  /** Rule tag each level's record was played under; missing = "" (original rules). */
  levelRules: z.record(z.string(), z.string()).default({}),
});

export type Submission = z.infer<typeof SubmissionSchema>;
export type Layout = z.infer<typeof LayoutSchema>;
export type StoredData = z.infer<typeof DataSchema>;

export interface LevelProgress {
  /** The first submission: the level's official score. */
  counted?: Submission;
  /** Every submission after the first, oldest first. */
  attempts: Submission[];
  /** Highest score over all submissions. */
  best?: Submission;
  /** Most recent submission (counted or attempt). */
  last?: Submission;
  /** The best layout tried so far: the highest-scoring one the board has shown, or a better submission. */
  bestTry?: Layout;
}

/** The subset of the Web Storage API we use; lets tests pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Store {
  readonly persistent: boolean;
  level(id: string): LevelProgress;
  /** Ids of every level with a counted submission. */
  played(): string[];
  /** Whether the level was ever finished: counted now, or before its rules changed (unlocks the next). */
  cleared(id: string): boolean;
  /** Keeps a tried layout if it scores more than the best one so far; returns whether it did. */
  tried(id: string, layout: Layout): boolean;
  /** Saves a submission; returns whether it became the counted one. */
  submit(id: string, s: Submission): { counted: boolean };
  theme(): string | undefined;
  setTheme(theme: string): void;
  /**
   * Called at start with the bundled campaign's version: if the stored campaign records belong to an
   * older version (the levels were redrawn), they move to the archive, so old scores don't show up on
   * different levels with the same number.
   */
  useCampaign(version: number): void;
  /**
   * Call before a level is shown with its rule tag (ruleTag in @engine). If the level was played under
   * other rules, its record moves to the archive ("rules-<tag>") and the level can be submitted again.
   */
  useRules(id: string, tag: string): void;
  /** Whether the first-visit "How to play" pop-up was already shown (always false without storage). */
  introSeen(): boolean;
  markIntroSeen(): void;
}

const empty = (): StoredData => ({ v: 1, settings: {}, levels: {}, archive: {}, levelRules: {} });
const CAMPAIGN_ID = /^lvl\d{2}$/;

export function createStore(storage: StorageLike | null = defaultStorage()): Store {
  let data = read();

  function read(): StoredData {
    if (!storage) return empty();
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return empty();
      const parsed = DataSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : empty(); // corrupted or foreign data: start fresh
    } catch {
      return empty();
    }
  }
  function write(): void {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // quota exceeded or storage blocked: keep playing with in-memory data
    }
  }

  const api: Store = {
    persistent: storage !== null,
    level(id) {
      const rec = data.levels[id];
      const all = [...(rec?.counted ? [rec.counted] : []), ...(rec?.attempts ?? [])];
      const best = all.reduce<Submission | undefined>((b, s) => (!b || s.score > b.score ? s : b), undefined);
      // Records from before bestTry existed: their best submission is the best layout tried.
      const bestTry =
        best && (!rec?.bestTry || best.score > rec.bestTry.score)
          ? { score: best.score, placements: best.placements }
          : rec?.bestTry;
      return {
        ...(rec?.counted ? { counted: rec.counted } : {}),
        attempts: rec?.attempts ?? [],
        ...(best ? { best } : {}),
        ...(all.length ? { last: all.at(-1) as Submission } : {}),
        ...(bestTry ? { bestTry } : {}),
      };
    },
    played: () => Object.keys(data.levels).filter((id) => data.levels[id]?.counted),
    cleared: (id) =>
      Boolean(data.levels[id]?.counted) ||
      Object.entries(data.archive).some(([box, recs]) => box.startsWith("rules-") && recs[id]?.counted),
    tried(id, layout) {
      const rec = data.levels[id] ?? { attempts: [] };
      const was = api.level(id).bestTry;
      if (was && was.score >= layout.score) return false;
      data = { ...data, levels: { ...data.levels, [id]: { ...rec, bestTry: layout } } };
      write();
      return true;
    },
    submit(id, s) {
      const rec = data.levels[id] ?? { attempts: [] };
      let counted = false;
      if (!rec.counted) {
        rec.counted = s;
        counted = true;
      } else {
        rec.attempts = [...rec.attempts, s].slice(-MAX_ATTEMPTS);
      }
      data = { ...data, levels: { ...data.levels, [id]: rec } };
      write();
      return { counted };
    },
    theme: () => data.settings.theme,
    setTheme(theme) {
      data = { ...data, settings: { ...data.settings, theme } };
      write();
    },
    useCampaign(version) {
      const stored = data.campaignVersion ?? 1;
      if (data.campaignVersion === version) return;
      const old = Object.entries(data.levels).filter(([id]) => CAMPAIGN_ID.test(id));
      const levels = Object.fromEntries(Object.entries(data.levels).filter(([id]) => !CAMPAIGN_ID.test(id)));
      const archive =
        stored !== version && old.length > 0
          ? { ...data.archive, [`campaign-v${stored}`]: Object.fromEntries(old) }
          : data.archive;
      data =
        stored !== version
          ? { ...data, levels, archive, campaignVersion: version }
          : { ...data, campaignVersion: version };
      write();
    },
    introSeen() {
      try {
        return storage?.getItem(INTRO_KEY) === "1";
      } catch {
        return false;
      }
    },
    markIntroSeen() {
      try {
        storage?.setItem(INTRO_KEY, "1");
      } catch {
        // storage blocked: the pop-up shows again next time, which is harmless
      }
    },
    useRules(id, tag) {
      const was = data.levelRules[id] ?? "";
      if (was === tag) return;
      const rec = data.levels[id];
      const levels = Object.fromEntries(Object.entries(data.levels).filter(([k]) => k !== id));
      const box = `rules-${tag || "original"}`;
      const archive = rec ? { ...data.archive, [box]: { ...data.archive[box], [id]: rec } } : data.archive;
      const levelRules = { ...data.levelRules };
      if (tag) levelRules[id] = tag;
      else delete levelRules[id];
      data = { ...data, levels, archive, levelRules };
      write();
    },
  };
  return api;
}

function defaultStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    const probe = "lwr:probe";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
