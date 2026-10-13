import { describe, expect, it } from 'vitest';
import { nextRandom, pickIndex, shuffle } from './rng';

describe('nextRandom', () => {
  it('is deterministic: the same state always yields the same value', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
  });

  it('stays within [0, 1) across many draws', () => {
    let state = 7;
    for (let i = 0; i < 5000; i += 1) {
      const step = nextRandom(state);
      expect(step.value).toBeGreaterThanOrEqual(0);
      expect(step.value).toBeLessThan(1);
      state = step.state;
    }
  });
});

describe('pickIndex', () => {
  it('returns an index inside the array bounds', () => {
    let state = 1;
    for (let i = 0; i < 1000; i += 1) {
      const step = pickIndex(state, 5);
      expect(step.index).toBeGreaterThanOrEqual(0);
      expect(step.index).toBeLessThan(5);
      state = step.state;
    }
  });

  it('rejects a non-positive length instead of returning NaN', () => {
    expect(() => pickIndex(1, 0)).toThrow(RangeError);
  });
});

describe('shuffle', () => {
  it('keeps every item exactly once and does not mutate the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e'] as const;
    const result = shuffle(99, input);
    expect([...result.items].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('is reproducible from the same state', () => {
    expect(shuffle(5, [1, 2, 3, 4, 5, 6]).items).toEqual(shuffle(5, [1, 2, 3, 4, 5, 6]).items);
  });
});
