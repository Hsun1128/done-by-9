import { describe, expect, it } from 'vitest';
import { createSeedSource, parseSeed } from './seed';

describe('parseSeed', () => {
  it('reads a numeric seed from the query string', () => {
    expect(parseSeed('?seed=42')).toBe(42);
    expect(parseSeed('?utm_source=x&seed=7')).toBe(7);
  });

  it('ignores missing, negative, fractional or non-numeric seeds', () => {
    expect(parseSeed('')).toBeNull();
    expect(parseSeed('?seed=-1')).toBeNull();
    expect(parseSeed('?seed=1.5')).toBeNull();
    expect(parseSeed('?seed=abc')).toBeNull();
    expect(parseSeed('?seed=99999999999')).toBeNull();
  });
});

describe('createSeedSource', () => {
  it('replays consecutive seeds starting at the URL seed', () => {
    const next = createSeedSource('?seed=10');
    expect([next(), next(), next()]).toEqual([10, 11, 12]);
  });

  it('falls back to random unsigned 32-bit seeds', () => {
    const next = createSeedSource('');
    const value = next();
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(2 ** 32);
  });
});
