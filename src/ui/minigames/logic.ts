/**
 * The rules of the four little games, as pure functions. The overlay only draws and listens;
 * every score comes from here so it can be tested without a browser.
 */

/** Uniform random in [0, 1). Injected so tests are deterministic. */
export type Random = () => number;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

// --- Cook: stop the marker on the sweet spot ---------------------------------------

/** Where the sweet spot sits on the 0-1 bar, and how wide the perfect zone is. */
export const COOK_SWEET_CENTER = 0.5;
export const COOK_PERFECT_HALF_WIDTH = 0.06;
/** Distance from the centre at which a press scores nothing. */
export const COOK_ZERO_AT = 0.36;
/** Seconds for the marker to cross the bar once, per round: it gets faster. */
export const COOK_ROUND_SECONDS: readonly number[] = [1.7, 1.35, 1.05];

/** A marker bouncing between 0 and 1: a triangle wave of period `2 * crossSeconds`. */
export function markerAt(seconds: number, crossSeconds: number, phase = 0): number {
  const cycle = (seconds / crossSeconds + phase) % 2;
  const t = cycle < 0 ? cycle + 2 : cycle;
  return t <= 1 ? t : 2 - t;
}

/** Score of one press: 1 inside the perfect zone, falling to 0 at `COOK_ZERO_AT` from the centre. */
export function cookScore(position: number): number {
  const off = Math.abs(position - COOK_SWEET_CENTER);
  if (off <= COOK_PERFECT_HALF_WIDTH) return 1;
  return clamp01(1 - (off - COOK_PERFECT_HALF_WIDTH) / (COOK_ZERO_AT - COOK_PERFECT_HALF_WIDTH));
}

// --- Scrub: tap fast enough ---------------------------------------------------------

export const SCRUB_SECONDS = 6;
export const SCRUB_TARGET_TAPS = 26;

export function scrubScore(taps: number): number {
  return clamp01(taps / SCRUB_TARGET_TAPS);
}

// --- Quiz: help with the sums -------------------------------------------------------

export interface QuizQuestion {
  readonly prompt: string;
  readonly options: readonly number[];
  /** Index into `options`. */
  readonly answer: number;
}

export const QUIZ_QUESTIONS = 3;

const randomInt = (random: Random, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

/** Three first-grade sums within 20, each with three distinct options. */
export function makeQuiz(random: Random): readonly QuizQuestion[] {
  return Array.from({ length: QUIZ_QUESTIONS }, () => {
    const subtract = random() < 0.4;
    const a = randomInt(random, subtract ? 8 : 3, subtract ? 18 : 12);
    const b = randomInt(random, 2, Math.min(9, subtract ? a - 1 : 20 - a));
    const result = subtract ? a - b : a + b;
    const wrong = new Set<number>();
    while (wrong.size < 2) {
      const candidate = result + randomInt(random, -3, 3);
      if (candidate !== result && candidate >= 0) wrong.add(candidate);
    }
    const options = [result, ...wrong];
    // Fisher-Yates so the right answer is not always first.
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const keep = options[i];
      const swap = options[j];
      if (keep !== undefined && swap !== undefined) {
        options[i] = swap;
        options[j] = keep;
      }
    }
    return { prompt: `${a} ${subtract ? '−' : '+'} ${b} = ?`, options, answer: options.indexOf(result) };
  });
}

export function quizScore(correct: number): number {
  return clamp01(correct / QUIZ_QUESTIONS);
}

// --- Pack: take what tomorrow needs, and nothing else -------------------------------

export interface PackItem {
  readonly id: string;
  readonly emoji: string;
  readonly label: string;
  readonly needed: boolean;
}

export const PACK_ITEMS: readonly PackItem[] = [
  { id: 'contact', emoji: '📒', label: '聯絡簿', needed: true },
  { id: 'bottle', emoji: '🧴', label: '水壺', needed: true },
  { id: 'art', emoji: '🎨', label: '美勞材料', needed: true },
  { id: 'lunch', emoji: '🍱', label: '便當袋', needed: true },
  { id: 'game', emoji: '🎮', label: '遊戲機', needed: false },
  { id: 'bear', emoji: '🧸', label: '大玩偶', needed: false },
  { id: 'candy', emoji: '🍬', label: '糖果', needed: false },
  { id: 'skate', emoji: '🛹', label: '滑板', needed: false },
];

/** Right items count, wrong items cost half as much, and the score never goes below zero. */
export function packScore(chosen: ReadonlySet<string>): number {
  const needed = PACK_ITEMS.filter((item) => item.needed);
  const right = needed.filter((item) => chosen.has(item.id)).length;
  const wrong = [...chosen].filter((id) => PACK_ITEMS.find((item) => item.id === id)?.needed !== true).length;
  return clamp01((right - wrong * 0.5) / needed.length);
}
