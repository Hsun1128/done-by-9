import { describe, expect, it } from 'vitest';
import type { Summary } from './engine/types';
import {
  EMPTY_SAVE,
  SAVE_KEY,
  betterEnding,
  loadSave,
  recordCtaClick,
  recordGame,
  resolveStorage,
  writeSave,
  type StorageLike,
} from './storage';

function memoryStore(initial?: string): StorageLike & { value: string | null } {
  const store = {
    value: initial ?? null,
    getItem: (key: string) => (key === SAVE_KEY ? store.value : null),
    setItem: (key: string, value: string) => {
      if (key === SAVE_KEY) store.value = value;
    },
  };
  return store;
}

const summary = (overrides: Partial<Summary>): Summary => ({
  ending: 'late',
  allDone: false,
  finishClock: 21 * 60,
  avgMood: 60,
  avgDiscipline: 50,
  bond: 50,
  breaths: 0,
  techniques: [],
  money: 500,
  spent: 1000,
  missed: 0,
  collapses: 0,
  forcedBreaks: 0,
  tomorrow: [],
  ...overrides,
});

describe('loadSave', () => {
  it('returns an empty save when nothing is stored', () => {
    expect(loadSave(memoryStore())).toEqual(EMPTY_SAVE);
  });

  it('round-trips a valid save', () => {
    const store = memoryStore();
    const save = recordGame(EMPTY_SAVE, summary({ ending: 'quiet', techniques: ['together'] }));
    expect(writeSave(store, save)).toBe(true);
    expect(loadSave(store)).toEqual(save);
  });

  it('falls back to an empty save for corrupt JSON or an unknown shape', () => {
    expect(loadSave(memoryStore('{not json'))).toEqual(EMPTY_SAVE);
    expect(loadSave(memoryStore(JSON.stringify({ version: 2, plays: 'many' })))).toEqual(EMPTY_SAVE);
  });

  it('survives a browser that throws on storage access', () => {
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSave(hostile)).toEqual(EMPTY_SAVE);
    expect(writeSave(hostile, EMPTY_SAVE)).toBe(false);
  });
});

describe('resolveStorage', () => {
  it('returns the real storage when it is usable', () => {
    const store = memoryStore();
    expect(resolveStorage(() => store)).toBe(store);
  });

  it('falls back to a working in-memory store when access throws', () => {
    const resolved = resolveStorage(() => {
      throw new Error('SecurityError');
    });
    expect(writeSave(resolved, { ...EMPTY_SAVE, plays: 3 })).toBe(true);
    expect(loadSave(resolved).plays).toBe(3);
  });
});

describe('recordGame', () => {
  it('counts plays, keeps the best ending, and accumulates unlocked techniques', () => {
    let save = recordGame(EMPTY_SAVE, summary({ ending: 'quiet', techniques: ['offer_choice'] }));
    save = recordGame(save, summary({ ending: 'chaos', techniques: ['nag'] }));
    expect(save.plays).toBe(2);
    expect(save.bestEnding).toBe('quiet');
    expect(save.techniquesSeen).toEqual(['nag', 'offer_choice']);
  });
});

describe('betterEnding', () => {
  it('ranks quiet > rushed > tight > late > chaos > collapsed', () => {
    expect(betterEnding(null, 'chaos')).toBe('chaos');
    expect(betterEnding('late', 'rushed')).toBe('rushed');
    expect(betterEnding('rushed', 'tight')).toBe('rushed');
    expect(betterEnding('collapsed', 'chaos')).toBe('chaos');
    expect(betterEnding('quiet', 'rushed')).toBe('quiet');
  });
});

describe('recordCtaClick', () => {
  it('increments the click counter without touching other fields', () => {
    expect(recordCtaClick(EMPTY_SAVE)).toEqual({ ...EMPTY_SAVE, ctaClicks: 1 });
  });
});
