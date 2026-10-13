import { z } from 'zod';
import { ENDING_IDS, STYLE_IDS, type EndingId, type Summary } from './engine/types';

export const SAVE_KEY = 'done-by-nine:save:v2';

const SaveSchema = z.object({
  version: z.literal(2),
  plays: z.number().int().nonnegative(),
  bestEnding: z.enum(ENDING_IDS).nullable(),
  techniquesSeen: z.array(z.enum(STYLE_IDS)),
  ctaClicks: z.number().int().nonnegative(),
});

export type SaveData = z.infer<typeof SaveSchema>;

/** The slice of `Storage` we use, so tests can pass a plain object. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** In-memory fallback used when the browser blocks persistent storage. */
function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

/**
 * Resolves a storage backend once at startup. Reading `window.localStorage` can
 * itself throw (blocked site data), so access is wrapped; play continues with
 * in-memory progress that simply does not survive a reload.
 */
export function resolveStorage(access: () => StorageLike): StorageLike {
  try {
    const store = access();
    store.getItem(SAVE_KEY);
    return store;
  } catch {
    return memoryStorage();
  }
}

export const EMPTY_SAVE: SaveData = {
  version: 2,
  plays: 0,
  bestEnding: null,
  techniquesSeen: [],
  ctaClicks: 0,
};

/**
 * Loads progress. Anything missing, unreadable or in an unknown shape yields a
 * fresh save: progress is a convenience, never a reason to block play.
 */
export function loadSave(store: StorageLike): SaveData {
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw === null) return EMPTY_SAVE;
    const parsed = SaveSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_SAVE;
  } catch {
    // Storage can throw (private mode, blocked cookies) and JSON can be corrupt.
    return EMPTY_SAVE;
  }
}

/** Persists progress. Returns false when the browser refuses; callers may ignore it. */
export function writeSave(store: StorageLike, save: SaveData): boolean {
  try {
    store.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

const ENDING_RANK: Readonly<Record<EndingId, number>> = {
  collapsed: 0,
  chaos: 1,
  late: 2,
  tight: 3,
  rushed: 4,
  quiet: 5,
};

export function betterEnding(a: EndingId | null, b: EndingId): EndingId {
  return a !== null && ENDING_RANK[a] >= ENDING_RANK[b] ? a : b;
}

/** Returns a new save with one finished evening recorded. */
export function recordGame(save: SaveData, summary: Summary): SaveData {
  return {
    ...save,
    plays: save.plays + 1,
    bestEnding: betterEnding(save.bestEnding, summary.ending),
    techniquesSeen: STYLE_IDS.filter(
      (style) => save.techniquesSeen.includes(style) || summary.techniques.includes(style),
    ),
  };
}

export function recordCtaClick(save: SaveData): SaveData {
  return { ...save, ctaClicks: save.ctaClicks + 1 };
}
