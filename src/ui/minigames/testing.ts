import { nextRandom } from '../../engine/rng';

/** A deterministic `Random` for tests, built on the game's own generator. */
export function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    const step = nextRandom(state);
    state = step.state;
    return step.value;
  };
}
