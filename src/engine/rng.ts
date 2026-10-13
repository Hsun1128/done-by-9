/**
 * Mulberry32 as a pure step function. The generator state is a plain number so
 * it can live inside GameState and a whole game replays from its seed.
 */
export interface RandomStep {
  /** Uniform in [0, 1). */
  readonly value: number;
  readonly state: number;
}

export function nextRandom(state: number): RandomStep {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

export interface IndexStep {
  readonly index: number;
  readonly state: number;
}

/** Uniform integer in [0, length). `length` must be positive. */
export function pickIndex(state: number, length: number): IndexStep {
  if (length <= 0) {
    throw new RangeError(`pickIndex needs a positive length, got ${length}`);
  }
  const step = nextRandom(state);
  return { index: Math.floor(step.value * length), state: step.state };
}

export interface ShuffleStep<T> {
  readonly items: readonly T[];
  readonly state: number;
}

/** Fisher-Yates shuffle that returns a new array and the advanced state. */
export function shuffle<T>(state: number, items: readonly T[]): ShuffleStep<T> {
  const copy = [...items];
  let current = state;
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const step = pickIndex(current, i + 1);
    current = step.state;
    const a = copy[i];
    const b = copy[step.index];
    if (a === undefined || b === undefined) {
      throw new RangeError('shuffle index out of range');
    }
    copy[i] = b;
    copy[step.index] = a;
  }
  return { items: copy, state: current };
}
