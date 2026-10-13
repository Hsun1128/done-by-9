import { describe, expect, it } from 'vitest';
import type { Summary } from './engine/types';
import { buildShareText } from './share';

const base: Summary = {
  ending: 'quiet',
  allDone: true,
  finishClock: 20 * 60 + 41,
  avgMood: 88,
  avgDiscipline: 72,
  bond: 64,
  breaths: 1,
  techniques: ['offer_choice'],
  money: 900,
  spent: 600,
  missed: 0,
  collapses: 0,
  forcedBreaks: 0,
  tomorrow: [],
};

describe('buildShareText', () => {
  it('states the finish time, ending, key meters and the site URL', () => {
    const text = buildShareText(base, 'https://done-by-nine.example');
    expect(text).toContain('20:41');
    expect(text).toContain('安靜的 21:00');
    expect(text).toContain('72');
    expect(text).toContain('88');
    expect(text).toContain('NT$600');
    expect(text.endsWith('https://done-by-nine.example')).toBe(true);
  });

  it('does not claim a finish time when tasks were left undone', () => {
    const text = buildShareText({ ...base, allDone: false, ending: 'late', finishClock: 21 * 60 + 4 }, 'https://x.example');
    expect(text).not.toContain('21:04');
    expect(text).toContain('沒有全部做完');
  });
});
