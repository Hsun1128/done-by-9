import { describe, expect, it } from 'vitest';
import { dayProgress, formatClock, minutesUntilEnd } from './clock';
import { DAY_END_MIN, DAY_START_MIN } from './constants';

describe('formatClock', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatClock(17 * 60 + 5)).toBe('17:05');
    expect(formatClock(DAY_START_MIN)).toBe('07:00');
    expect(formatClock(DAY_END_MIN)).toBe('21:00');
  });
});

describe('minutesUntilEnd', () => {
  it('counts down to 21:00 and never goes negative', () => {
    expect(minutesUntilEnd(DAY_START_MIN)).toBe(14 * 60);
    expect(minutesUntilEnd(DAY_END_MIN + 30)).toBe(0);
  });
});

describe('dayProgress', () => {
  it('runs from 0 at 07:00 to 1 at 21:00 and is clamped outside', () => {
    expect(dayProgress(DAY_START_MIN)).toBe(0);
    expect(dayProgress(DAY_END_MIN)).toBe(1);
    expect(dayProgress(0)).toBe(0);
    expect(dayProgress(24 * 60)).toBe(1);
  });
});
