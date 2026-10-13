import {
  DAY_END_MIN,
  LATE_MIN_MOOD,
  MAX_COLLAPSES,
  MAX_TOMORROW_SHOWN,
  QUIET_MIN_DISCIPLINE,
  QUIET_MIN_MOOD,
  TECHNIQUE_MIN_USES,
} from './constants';
import { allDone } from './game';
import { KID_IDS, STYLE_IDS, type EndingId, type GameState, type Style, type Summary } from './types';

const average = (values: readonly number[]): number =>
  Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

export function evaluateEnding(input: {
  readonly allDone: boolean;
  readonly finishClock: number;
  readonly collapses: number;
  readonly money: number;
  readonly avgMood: number;
  readonly avgDiscipline: number;
}): EndingId {
  if (input.collapses >= MAX_COLLAPSES) return 'collapsed';
  const onTime = input.allDone && input.finishClock <= DAY_END_MIN;
  if (onTime) {
    if (input.money < 0) return 'tight';
    return input.avgDiscipline >= QUIET_MIN_DISCIPLINE && input.avgMood >= QUIET_MIN_MOOD
      ? 'quiet'
      : 'rushed';
  }
  return input.avgMood >= LATE_MIN_MOOD ? 'late' : 'chaos';
}

function topTechniques(counts: Readonly<Record<Style, number>>): readonly Style[] {
  const ranked = [...STYLE_IDS].sort((a, b) => counts[b] - counts[a]);
  const used = ranked.filter((style) => counts[style] >= TECHNIQUE_MIN_USES);
  if (used.length > 0) return used;
  const first = ranked[0];
  return first !== undefined && counts[first] > 0 ? [first] : [];
}

/** Builds the result-screen summary. Only valid for a finished game. */
export function summarize(state: GameState): Summary {
  if (!state.finished) {
    throw new Error('summarize() requires a finished game');
  }
  const done = allDone(state);
  const avgMood = average(KID_IDS.map((id) => state.kids[id].mood));
  const avgDiscipline = average(KID_IDS.map((id) => state.kids[id].discipline));
  return {
    ending: evaluateEnding({
      allDone: done,
      finishClock: state.clock,
      collapses: state.collapses,
      money: state.money,
      avgMood,
      avgDiscipline,
    }),
    allDone: done,
    finishClock: state.clock,
    avgMood,
    avgDiscipline,
    bond: Math.round(state.bond),
    breaths: state.breaths,
    techniques: topTechniques(state.styleCounts),
    money: Math.round(state.money),
    spent: Math.round(state.spent),
    missed: state.missed,
    collapses: state.collapses,
    forcedBreaks: state.forcedBreaks,
    tomorrow: state.tomorrow.slice(0, MAX_TOMORROW_SHOWN),
  };
}
