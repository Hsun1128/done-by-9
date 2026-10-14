import { act, careAt, careStatus, choreAt, createGame, interactionAt, nextUp } from './game';
import { summarize } from './summary';
import {
  type CareId,
  type EventChoice,
  type GameEvent,
  type GameState,
  type KidId,
  type Style,
  type Summary,
  type ZoneId,
} from './types';
import { travelUnits } from './pathing';

/** Picks one choice of an event. Used by balance tests and bots. */
export type Chooser = (event: GameEvent, state: GameState) => EventChoice;

export interface Bot {
  readonly choose: Chooser;
  /** When true the bot eats, rests and goes to the toilet before the body forces it. */
  readonly looksAfterItself: boolean;
  /** When set, the bot does chores by hand whenever it can, scoring this well (0-1). */
  readonly chore?: number;
}

const MAX_STEPS = 4000;

const first = (event: GameEvent): EventChoice => {
  const choice = event.choices[0];
  if (choice === undefined) throw new RangeError(`Event ${event.id} has no choices`);
  return choice;
};

/** Always picks `style` when offered, otherwise the first choice. */
export function alwaysStyle(style: Style, looksAfterItself = true): Bot {
  return {
    looksAfterItself,
    choose: (event) => event.choices.find((c) => c.style === style) ?? first(event),
  };
}

const PREFERENCE: Readonly<Record<KidId, readonly Style[]>> = {
  elder: ['offer_choice', 'together', 'wait', 'do_for', 'nag'],
  younger: ['together', 'offer_choice', 'do_for', 'wait', 'nag'],
};

function targetKid(event: GameEvent): KidId {
  return event.target.kind === 'family' ? 'elder' : event.target.kid;
}

/** A thoughtful player: matches the style to the kid and keeps money worries in proportion. */
export const thoughtful: Bot = {
  looksAfterItself: true,
  choose: (event, state) => {
    // Money-aware: when the budget is thin, take the cheaper of the gentle options.
    const affordable = event.choices.filter((c) => state.money + c.money >= 0);
    const pool = affordable.length > 0 ? affordable : event.choices;
    for (const style of PREFERENCE[targetKid(event)]) {
      const match = pool.find((c) => c.style === style);
      if (match !== undefined) return match;
    }
    return pool[0] ?? first(event);
  },
};

/** A thoughtful player who also does the chores by hand, with the given skill (0 = hopeless, 1 = perfect). */
export const handy = (skill: number): Bot => ({ ...thoughtful, chore: skill });

/** Always the choice that saves the most minutes, whatever it costs. */
export const buyTime: Bot = {
  looksAfterItself: true,
  choose: (event) =>
    [...event.choices].sort((a, b) => a.minutes - b.minutes || a.money - b.money)[0] ?? first(event),
};

/** Always the choice that costs the least NT$, then the most minutes it saves. */
export const savePennies: Bot = {
  looksAfterItself: true,
  choose: (event) =>
    [...event.choices].sort((a, b) => b.money - a.money || a.minutes - b.minutes)[0] ?? first(event),
};

/** Ignores their own body and only ever answers the kids. */
export const selfless: Bot = { ...thoughtful, looksAfterItself: false };

function careToDo(state: GameState): CareId | null {
  const urgent: readonly (readonly [boolean, CareId])[] = [
    [state.bladder > 60, 'toilet'],
    [state.fullness < 40, 'eat'],
    [state.energy < 40 || state.patience < 30, 'rest'],
  ];
  for (const [needed, care] of urgent) {
    if (needed && careStatus(state, care) === 'ok') return care;
  }
  return null;
}

const CARE_ZONE: Readonly<Record<CareId, ZoneId>> = {
  eat: 'table',
  rest: 'sofa',
  coffee: 'sink',
  toilet: 'tub',
};

/** Walk to a zone: charge the time, then stand there. */
function goTo(state: GameState, zone: ZoneId): GameState {
  const walked = act(state, { kind: 'walk', units: travelUnits(state.at, zone) });
  return act(walked, { kind: 'arrive', zone });
}

/** One high-level step of a bot: decide where to go and what to do there. */
function step(state: GameState, bot: Bot): GameState {
  if (state.pending !== null) {
    return act(state, { kind: 'choose', choiceId: bot.choose(state.pending.event, state).id });
  }
  const care = bot.looksAfterItself ? careToDo(state) : null;
  if (care !== null) {
    const there = state.at === CARE_ZONE[care] ? state : goTo(state, CARE_ZONE[care]);
    if (there.finished) return there;
    return careAt(there).includes(care) ? act(there, { kind: 'care', care }) : there;
  }
  const target = nextUp(state);
  if (target === null) return act(state, { kind: 'breathe' });
  const there = state.at === target.zone ? state : goTo(state, target.zone);
  if (there.finished) return there;
  const offer = choreAt(there);
  if (bot.chore !== undefined && offer !== null) return act(there, { kind: 'chore', score: bot.chore });
  if (interactionAt(there).kind === 'none' || interactionAt(there).kind === 'blocked') {
    return act(there, { kind: 'breathe' });
  }
  return act(there, { kind: 'interact' });
}

export function playGame(
  seed: number,
  bot: Bot,
): { readonly final: GameState; readonly summary: Summary } {
  let state = createGame(seed);
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (state.finished) return { final: state, summary: summarize(state) };
    state = step(state, bot);
  }
  throw new RangeError(`Game did not finish within ${MAX_STEPS} steps (seed ${seed})`);
}
