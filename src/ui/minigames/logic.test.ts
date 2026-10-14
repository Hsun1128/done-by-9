import { describe, expect, it } from 'vitest';
import { mulberry } from './testing';
import {
  COOK_PERFECT_HALF_WIDTH,
  COOK_SWEET_CENTER,
  COOK_ZERO_AT,
  PACK_ITEMS,
  QUIZ_QUESTIONS,
  SCRUB_TARGET_TAPS,
  cookScore,
  makeQuiz,
  markerAt,
  packScore,
  quizScore,
  scrubScore,
} from './logic';

describe('cooking: the marker bounces and a press scores by how close it is to the sweet spot', () => {
  it('bounces between 0 and 1 and never leaves the bar', () => {
    for (let t = 0; t < 10; t += 0.07) {
      const m = markerAt(t, 1.3, 0.4);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
    }
    expect(markerAt(0, 1)).toBe(0);
    expect(markerAt(1, 1)).toBe(1);
    expect(markerAt(2, 1)).toBeCloseTo(0);
  });

  it('gives a perfect score anywhere in the perfect zone', () => {
    expect(cookScore(COOK_SWEET_CENTER)).toBe(1);
    expect(cookScore(COOK_SWEET_CENTER + COOK_PERFECT_HALF_WIDTH - 0.001)).toBe(1);
    expect(cookScore(COOK_SWEET_CENTER - COOK_PERFECT_HALF_WIDTH + 0.001)).toBe(1);
  });

  it('scores nothing at the edges of the bar and falls off smoothly in between', () => {
    expect(cookScore(0)).toBe(0);
    expect(cookScore(1)).toBe(0);
    expect(cookScore(COOK_SWEET_CENTER + COOK_ZERO_AT)).toBeCloseTo(0);
    const near = cookScore(0.6);
    const far = cookScore(0.75);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });
});

describe('scrubbing: taps fill the bar', () => {
  it('scores in proportion to the taps and tops out at the target', () => {
    expect(scrubScore(0)).toBe(0);
    expect(scrubScore(SCRUB_TARGET_TAPS / 2)).toBeCloseTo(0.5);
    expect(scrubScore(SCRUB_TARGET_TAPS)).toBe(1);
    expect(scrubScore(SCRUB_TARGET_TAPS * 3)).toBe(1);
  });
});

describe('the quiz: first-grade sums', () => {
  it('asks three questions with three distinct options, exactly one of them right', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const quiz = makeQuiz(mulberry(seed));
      expect(quiz).toHaveLength(QUIZ_QUESTIONS);
      for (const question of quiz) {
        expect(new Set(question.options).size).toBe(3);
        const [a, op, b] = question.prompt.split(' ');
        const expected = op === '+' ? Number(a) + Number(b) : Number(a) - Number(b);
        expect(question.options[question.answer]).toBe(expected);
        expect(question.options.every((option) => option >= 0)).toBe(true);
        expect(expected).toBeLessThanOrEqual(20);
      }
    }
  });

  it('does not always put the right answer first', () => {
    const positions = new Set(
      Array.from({ length: 40 }, (_, seed) => makeQuiz(mulberry(seed + 1))[0]?.answer),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it('scores by the share of right answers', () => {
    expect(quizScore(0)).toBe(0);
    expect(quizScore(QUIZ_QUESTIONS)).toBe(1);
    expect(quizScore(1)).toBeCloseTo(1 / 3);
  });
});

describe('packing: take what is needed and nothing else', () => {
  const needed = PACK_ITEMS.filter((item) => item.needed).map((item) => item.id);
  const extras = PACK_ITEMS.filter((item) => !item.needed).map((item) => item.id);

  it('scores 1 for exactly the needed items and 0 for nothing', () => {
    expect(packScore(new Set(needed))).toBe(1);
    expect(packScore(new Set())).toBe(0);
  });

  it('penalises each extra item by half of what a right item earns', () => {
    expect(packScore(new Set([...needed, extras[0] ?? '']))).toBeCloseTo(1 - 0.5 / needed.length);
    expect(packScore(new Set(extras))).toBe(0);
  });
});
