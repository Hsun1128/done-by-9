import { describe, expect, it } from 'vitest';
import { eventById } from '../data/deck';
import {
  CARE,
  CHORES,
  COLLAPSE_MINUTES,
  DAY_END_MIN,
  DAY_START_MIN,
  FORCED_BREAK_MINUTES,
  MAX_COFFEES,
  MAX_OPEN_EVENTS,
  MONEY_START,
  WALK_UNITS_PER_MINUTE,
} from './constants';
import {
  InvalidActionError,
  act,
  activeTask,
  careAt,
  careStatus,
  checkinKidAt,
  choreAt,
  createGame,
  interactionAt,
  kidZone,
  needsAttention,
  nextUp,
  openViews,
  zoneOfEvent,
} from './game';
import type { GameState, ZoneId } from './types';

/** Lets `minutes` pass by walking exactly that long. */
const idle = (game: GameState, minutes: number): GameState =>
  act(game, { kind: 'walk', units: minutes * WALK_UNITS_PER_MINUTE });

const at = (game: GameState, zone: ZoneId | null): GameState => act(game, { kind: 'arrive', zone });

/** A game with `eventId` open and the parent standing in its room. */
function withOpen(game: GameState, eventId: string, ttl = 40): GameState {
  const event = eventById(eventId);
  const zone = zoneOfEvent(event, game);
  return {
    ...game,
    at: zone,
    open: [...game.open, { eventId, appeared: game.clock, expires: game.clock + ttl }],
    seenEvents: [...game.seenEvents, eventId],
  };
}

const finishTask = (game: GameState, kid: 'elder' | 'younger', ...tasks: readonly string[]) => ({
  ...game,
  kids: {
    ...game.kids,
    [kid]: {
      ...game.kids[kid],
      progress: {
        ...game.kids[kid].progress,
        ...Object.fromEntries(tasks.map((task) => [task, 100])),
      },
    },
  },
});

/** Dinner time: breakfast, lunch and homework are done and nothing else is open. */
function dinnerTime(): GameState {
  const base = { ...createGame(1), clock: 18 * 60, open: [] };
  const done = ['breakfast', 'lunch', 'homework'] as const;
  const fed = finishTask(finishTask(base, 'elder', ...done), 'younger', ...done);
  const fresh = (kid: GameState['kids']['elder']) => ({ ...kid, lastAttended: fed.clock });
  return { ...fed, kids: { elder: fresh(fed.kids.elder), younger: fresh(fed.kids.younger) } };
}

describe('a new day', () => {
  it('starts at 07:00 with your partner waiting at the front door', () => {
    const game = createGame(1);
    expect(game.clock).toBe(7 * 60);
    expect(openViews(game).map((view) => [view.event.id, view.zone])).toEqual([['partner-leaves', 'door']]);
  });

  it('keeps each task closed until its time, so kids are playing on the sofa in between', () => {
    const noon = { ...createGame(1), clock: 11 * 60 };
    const fed = finishTask(finishTask(noon, 'elder', 'breakfast'), 'younger', 'breakfast');
    expect(activeTask(fed.kids.elder, fed.clock)).toBeNull();
    expect(kidZone(fed.kids.elder, fed.clock, 'elder')).toBe('sofa');
    expect(activeTask(fed.kids.elder, 12 * 60)).toBe('lunch');
  });
});

describe('a new evening', () => {
  it('starts at 17:30 with a full wallet, an empty stomach and nobody anywhere', () => {
    const game = createGame(1);
    expect(game.clock).toBe(DAY_START_MIN);
    expect(game.money).toBe(MONEY_START);
    expect(game.fullness).toBeLessThan(50);
    expect(game.at).toBeNull();
    expect(game.finished).toBe(false);
  });

  it('puts each kid at the table first and sends finished kids to the sofa', () => {
    const game = dinnerTime();
    expect(kidZone(game.kids.elder, game.clock, 'elder')).toBe('table');
    const done = finishTask(
      createGame(1),
      'elder',
      'breakfast',
      'lunch',
      'dinner',
      'homework',
      'dishes',
      'bath',
      'bag',
    );
    expect(activeTask(done.kids.elder, done.clock)).toBeNull();
    expect(kidZone(done.kids.elder, done.clock, 'elder')).toBe('sofa');
  });
});

describe('walking', () => {
  it('charges whole minutes and carries the remainder to the next step', () => {
    let game = createGame(1);
    game = act(game, { kind: 'walk', units: WALK_UNITS_PER_MINUTE * 0.6 });
    expect(game.clock).toBe(DAY_START_MIN);
    game = act(game, { kind: 'walk', units: WALK_UNITS_PER_MINUTE * 0.6 });
    expect(game.clock).toBe(DAY_START_MIN + 1);
    expect(game.walkRemainder).toBeCloseTo(0.2);
  });

  it('refuses to walk while a conversation is open', () => {
    const game = act(withOpen(createGame(1), 'lost-eraser'), { kind: 'interact' });
    expect(game.pending).not.toBeNull();
    expect(() => act(game, { kind: 'walk', units: 1 })).toThrow(InvalidActionError);
  });

  it('refuses nonsense distances', () => {
    expect(() => act(createGame(1), { kind: 'walk', units: -1 })).toThrow(InvalidActionError);
    expect(() => act(createGame(1), { kind: 'walk', units: Number.NaN })).toThrow(InvalidActionError);
  });
});

describe('arriving', () => {
  it('records the room for free and returns the same state when nothing changed', () => {
    const game = at(createGame(1), 'desk');
    expect(game.at).toBe('desk');
    expect(game.clock).toBe(DAY_START_MIN);
    expect(at(game, 'desk')).toBe(game);
  });
});

describe('time passing', () => {
  it('tires and hungers the parent and builds bladder pressure', () => {
    const before = createGame(1);
    const after = idle(before, 30);
    expect(after.energy).toBeLessThan(before.energy);
    expect(after.fullness).toBeLessThan(before.fullness);
    expect(after.bladder).toBeGreaterThan(before.bladder);
  });

  it('lets a kid who is left alone slowly make progress and, after a while, grow upset', () => {
    const before = dinnerTime();
    const after = idle(before, 90);
    expect(after.kids.elder.progress.dinner).toBeGreaterThan(0);
    expect(after.kids.elder.mood).toBeLessThan(before.kids.elder.mood);
  });

  it('makes kids need attention once the parent has stayed away long enough', () => {
    const game = dinnerTime();
    expect(needsAttention(game, 'elder')).toBe(false);
    expect(needsAttention(idle(game, 45), 'elder')).toBe(true);
  });

  it('ends the evening at 21:00', () => {
    const game = idle(createGame(1), 900);
    expect(game.finished).toBe(true);
    expect(game.clock).toBeLessThanOrEqual(DAY_END_MIN + 20);
  });
});

describe('talking to a kid', () => {
  it('offers nothing in an empty room and a routine check-in at a kid\'s task', () => {
    expect(interactionAt(at(createGame(1), 'ledger'))).toEqual({ kind: 'none' });
    expect(interactionAt(at(createGame(1), 'table')).kind).toBe('checkin');
  });

  it('picks the kid who is further behind when both work in the same room', () => {
    const game = at(
      {
        ...createGame(1),
        kids: {
          ...createGame(1).kids,
          younger: {
            ...createGame(1).kids.younger,
            progress: { breakfast: 100, lunch: 100, dinner: 60, homework: 100, dishes: 0, bath: 0, bag: 0 },
          },
        },
      },
      'table',
    );
    expect(checkinKidAt(game, 'table')).toBe('elder');
  });

  it('shows the checkin\'s choices shuffled, trimmed, and cancellable for free', () => {
    const talking = act(at(createGame(1), 'table'), { kind: 'interact' });
    expect(talking.pending?.event.kind).toBe('checkin');
    expect(talking.pending?.event.choices.length).toBeGreaterThanOrEqual(3);
    const left = act(talking, { kind: 'leave' });
    expect(left.pending).toBeNull();
    expect(left.clock).toBe(talking.clock);
  });

  it('moves the kid\'s task forward, uses time, and tires the parent', () => {
    const talking = act(at(dinnerTime(), 'table'), { kind: 'interact' });
    const choice = talking.pending?.event.choices.find((c) => c.style === 'do_for');
    if (choice === undefined) throw new Error('every check-in offers some choices; do_for was trimmed');
    const after = act(talking, { kind: 'choose', choiceId: choice.id });
    expect(after.clock).toBeGreaterThan(talking.clock);
    expect(after.energy).toBeLessThan(talking.energy);
    expect(Math.max(after.kids.elder.progress.dinner, after.kids.younger.progress.dinner)).toBe(100);
    expect(after.pending).toBeNull();
  });

  it('refuses a choice that was never offered', () => {
    const talking = act(at(createGame(1), 'table'), { kind: 'interact' });
    expect(() => act(talking, { kind: 'choose', choiceId: 'nope' })).toThrow(InvalidActionError);
  });

  it('resets the kid\'s waiting clock', () => {
    const waited = idle(createGame(1), 30);
    const talking = act(at(waited, 'table'), { kind: 'interact' });
    const choice = talking.pending?.event.choices[0];
    if (choice === undefined) throw new Error('no choices');
    const after = act(talking, { kind: 'choose', choiceId: choice.id });
    const kid = talking.pending?.event.target.kind === 'task' ? talking.pending.event.target.kid : 'elder';
    expect(needsAttention(after, kid)).toBe(false);
  });
});

describe('events', () => {
  it('prefers an open event in the room over a routine check-in', () => {
    const game = withOpen(createGame(1), 'milk-spill');
    expect(interactionAt(game)).toEqual({ kind: 'event', eventId: 'milk-spill', urgent: false });
  });

  it('blocks every other room while an urgent event is open', () => {
    const game = at(withOpen(createGame(1), 'fever'), 'desk');
    const interaction = interactionAt(game);
    expect(interaction.kind).toBe('blocked');
    expect(() => act(game, { kind: 'interact' })).toThrow(InvalidActionError);
  });

  it('lets the parent handle the urgent event in its own room, and points the way with nextUp', () => {
    const base = withOpen(createGame(1), 'fever');
    expect(interactionAt(base)).toEqual({ kind: 'event', eventId: 'fever', urgent: true });
    const elsewhere = at(base, 'ledger');
    expect(nextUp(elsewhere)?.reason).toBe('urgent');
    expect(nextUp(elsewhere)?.zone).toBe(zoneOfEvent(eventById('fever'), elsewhere));
  });

  it('removes the event once answered', () => {
    const talking = act(withOpen(createGame(1), 'milk-spill'), { kind: 'interact' });
    const choice = talking.pending?.event.choices[0];
    if (choice === undefined) throw new Error('no choices');
    const after = act(talking, { kind: 'choose', choiceId: choice.id });
    expect(after.open.some((open) => open.eventId === 'milk-spill')).toBe(false);
  });

  it('lapses an unanswered event: kids and parent pay, a loose end is carried to tomorrow', () => {
    const game = withOpen(createGame(1), 'school-fee', 3);
    const after = idle({ ...game, at: null }, 5);
    expect(after.missed).toBeGreaterThanOrEqual(1);
    expect(after.tomorrow).toContain('繳班費 NT$300');
    expect(after.log.some((entry) => entry.style === 'lapse')).toBe(true);
  });

  it('drops an event silently when the thing it was about finished by itself', () => {
    const game = finishTask(withOpen(createGame(1), 'milk-spill', 3), 'younger', 'dinner');
    const after = idle({ ...game, at: null }, 5);
    expect(after.log.some((entry) => entry.eventId === 'milk-spill' && entry.style === 'lapse')).toBe(false);
    expect(after.open.some((open) => open.eventId === 'milk-spill')).toBe(false);
  });

  it('lists open events with urgent ones first', () => {
    const game = withOpen(withOpen(createGame(1), 'school-fee'), 'fever');
    expect(openViews(game)[0]?.urgent).toBe(true);
  });

  it('only ever shows an event inside its window, and never more than the cap or two urgent at once', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      let game = createGame(seed);
      for (let minute = 0; minute < 200 && !game.finished; minute += 1) {
        game = idle(game, 1);
        expect(game.open.length).toBeLessThanOrEqual(MAX_OPEN_EVENTS);
        expect(game.open.filter((o) => eventById(o.eventId).urgent).length).toBeLessThanOrEqual(1);
        for (const open of game.open) {
          const event = eventById(open.eventId);
          expect(open.appeared).toBeGreaterThanOrEqual(event.window.from);
          expect(open.appeared).toBeLessThan(event.window.to);
        }
      }
    }
  });
});

describe('money', () => {
  const choose = (game: GameState, eventId: string, slug: string): GameState =>
    act(act(game, { kind: 'interact' }), { kind: 'choose', choiceId: `${eventId}:${slug}` });

  it('spends NT$ and records the total spent', () => {
    const after = choose(withOpen(createGame(1), 'school-fee'), 'school-fee', 'pay');
    expect(after.money).toBe(MONEY_START - 300);
    expect(after.spent).toBe(300);
  });

  it('adds NT$ for income', () => {
    const after = choose(withOpen(createGame(1), 'grandma-transfer'), 'grandma-transfer', 'text');
    expect(after.money).toBe(MONEY_START + 500);
    expect(after.spent).toBe(0);
  });

  it('costs extra patience when a purchase leaves the budget thin, and more when it goes into debt', () => {
    const rich = choose(withOpen(createGame(1), 'school-fee'), 'school-fee', 'pay');
    const thin = choose(
      withOpen({ ...createGame(1), money: 700 }, 'school-fee'),
      'school-fee',
      'pay',
    );
    const debt = choose(
      withOpen({ ...createGame(1), money: 100 }, 'school-fee'),
      'school-fee',
      'pay',
    );
    expect(thin.patience).toBeLessThan(rich.patience);
    expect(debt.patience).toBeLessThan(thin.patience);
  });

  it('carries a promise to tomorrow only once, however many times it is made', () => {
    const first = choose(withOpen(createGame(1), 'school-fee'), 'school-fee', 'cash');
    expect(first.tomorrow).toEqual(['早上提款，把班費放進書包']);
  });
});

describe('looking after yourself', () => {
  it('lets you eat only at the table, and the meal feeds you and takes time', () => {
    const game = at(createGame(1), 'table');
    expect(careAt(game)).toContain('eat');
    const after = act(game, { kind: 'care', care: 'eat' });
    expect(after.fullness).toBeGreaterThan(game.fullness + 30);
    expect(after.clock).toBe(game.clock + CARE.eat.minutes);
    expect(() => act(at(createGame(1), 'sofa'), { kind: 'care', care: 'eat' })).toThrow(InvalidActionError);
  });

  it('refuses help you do not need', () => {
    const full = { ...at(createGame(1), 'table'), fullness: 95 };
    expect(careStatus(full, 'eat')).toBe('not_needed');
    expect(() => act(full, { kind: 'care', care: 'eat' })).toThrow(InvalidActionError);
  });

  it('gives only a couple of coffees, and each one pushes the bladder', () => {
    let game = at(createGame(1), 'sink');
    const start = game.bladder;
    for (let i = 0; i < MAX_COFFEES; i += 1) game = act(game, { kind: 'care', care: 'coffee' });
    expect(game.bladder).toBeGreaterThan(start + 20);
    expect(careStatus(game, 'coffee')).toBe('used_up');
  });

  it('empties the bladder in the bathroom', () => {
    const game = { ...at(createGame(1), 'tub'), bladder: 70 };
    expect(careAt(game)).toEqual(['toilet']);
    expect(act(game, { kind: 'care', care: 'toilet' }).bladder).toBeLessThan(10);
  });

  it('rests on the sofa to win energy and patience back', () => {
    const tired = { ...at(createGame(1), 'sofa'), energy: 20, patience: 40 };
    const after = act(tired, { kind: 'care', care: 'rest' });
    expect(after.energy).toBeGreaterThan(tired.energy + 10);
    expect(after.patience).toBeGreaterThan(tired.patience);
  });

  it('lets you breathe anywhere for patience at the cost of a few minutes', () => {
    const game = { ...createGame(1), patience: 40 };
    const after = act(game, { kind: 'breathe' });
    expect(after.patience).toBeGreaterThan(40);
    expect(after.breaths).toBe(1);
    expect(after.clock).toBeGreaterThan(game.clock);
  });
});

describe('when the body gives out', () => {
  it('falls asleep for twenty minutes the first time energy runs out', () => {
    const game = { ...createGame(1), energy: 0.01 };
    const after = idle(game, 1);
    expect(after.collapses).toBe(1);
    expect(after.clock).toBe(game.clock + 1 + COLLAPSE_MINUTES);
    expect(after.energy).toBeGreaterThan(20);
    expect(after.finished).toBe(false);
  });

  it('ends the evening the second time', () => {
    const game = { ...createGame(1), energy: 0.01, collapses: 1 };
    expect(idle(game, 1).finished).toBe(true);
  });

  it('forces a bathroom break when the bladder fills up, taking the parent away from the kids', () => {
    const game = { ...createGame(1), bladder: 99.9 };
    const after = idle(game, 1);
    expect(after.forcedBreaks).toBe(1);
    expect(after.clock).toBe(game.clock + 1 + FORCED_BREAK_MINUTES);
    expect(after.bladder).toBeLessThan(20);
    expect(after.patience).toBeLessThan(game.patience);
  });

  it('points a desperate parent towards the sofa, the bathroom or the table', () => {
    expect(nextUp({ ...createGame(1), energy: 10 })?.zone).toBe('sofa');
    expect(nextUp({ ...createGame(1), bladder: 95 })?.zone).toBe('tub');
    expect(nextUp({ ...createGame(1), fullness: 5 })?.zone).toBe('table');
  });
});

describe('finishing', () => {
  it('ends as soon as both kids have finished everything', () => {
    const tasks = ['breakfast', 'lunch', 'homework', 'dinner', 'dishes', 'bath', 'bag'] as const;
    let game = finishTask(createGame(1), 'elder', ...tasks);
    game = finishTask(game, 'younger', ...tasks);
    expect(idle(game, 1).finished).toBe(true);
  });

  it('refuses every action once the evening is over', () => {
    const over = idle(createGame(1), 900);
    expect(() => act(over, { kind: 'walk', units: 1 })).toThrow(InvalidActionError);
    expect(() => act(over, { kind: 'breathe' })).toThrow(InvalidActionError);
  });
});

describe('replay', () => {
  it('reproduces the same evening from the same seed and the same actions', () => {
    const play = (): GameState => {
      let game = createGame(42);
      game = idle(game, 20);
      game = at(game, 'table');
      game = act(game, { kind: 'interact' });
      const choice = game.pending?.event.choices[0];
      if (choice === undefined) throw new Error('no choices');
      return idle(act(game, { kind: 'choose', choiceId: choice.id }), 25);
    };
    expect(play()).toEqual(play());
  });

  it('plays differently with a different seed', () => {
    const run = (seed: number): number => idle(createGame(seed), 120).seenEvents.length;
    const counts = new Set(Array.from({ length: 12 }, (_, i) => run(i + 1)));
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe('doing a chore by hand', () => {
  it('is offered at the table at dinner time, for both kids who are waiting there', () => {
    const game = at(dinnerTime(), 'table');
    expect(choreAt(game)).toEqual({ task: 'dinner', game: 'cook', kids: ['elder', 'younger'] });
  });

  it('is not offered where no kid is waiting, or while a conversation is open', () => {
    expect(choreAt(at(dinnerTime(), 'tub'))).toBeNull();
    expect(choreAt(at(dinnerTime(), null))).toBeNull();
    const talking = act(at(dinnerTime(), 'table'), { kind: 'interact' });
    expect(choreAt(talking)).toBeNull();
  });

  it('moves every waiting kid forward, and a better score moves them further', () => {
    const game = at(dinnerTime(), 'table');
    const poor = act(game, { kind: 'chore', score: 0 });
    const great = act(game, { kind: 'chore', score: 1 });
    expect(poor.kids.elder.progress.dinner).toBeGreaterThanOrEqual(CHORES.dinner.base);
    expect(great.kids.elder.progress.dinner).toBeGreaterThan(poor.kids.elder.progress.dinner);
    expect(great.kids.younger.progress.dinner).toBe(great.kids.elder.progress.dinner);
  });

  it('costs minutes and energy, and a botched job also costs patience and mood', () => {
    const game = at(dinnerTime(), 'table');
    const poor = act(game, { kind: 'chore', score: 0 });
    const great = act(game, { kind: 'chore', score: 1 });
    expect(poor.clock).toBeGreaterThan(game.clock);
    expect(poor.energy).toBeLessThan(game.energy);
    expect(poor.patience).toBeLessThan(great.patience);
    expect(poor.kids.elder.mood).toBeLessThan(great.kids.elder.mood);
  });

  it('records the score for the result screen', () => {
    const done = act(at(dinnerTime(), 'table'), { kind: 'chore', score: 0.8 });
    expect(done.choreScores).toEqual([0.8]);
  });

  it('rejects an impossible score and a chore with nothing to do', () => {
    const game = at(dinnerTime(), 'table');
    expect(() => act(game, { kind: 'chore', score: 1.5 })).toThrow(InvalidActionError);
    expect(() => act(game, { kind: 'chore', score: Number.NaN })).toThrow(InvalidActionError);
    expect(() => act(at(dinnerTime(), 'tub'), { kind: 'chore', score: 1 })).toThrow(InvalidActionError);
  });

  it('is blocked while something urgent waits in another room', () => {
    // The younger kid has finished dinner and is playing elsewhere; the fever is where she plays.
    const base = finishTask(dinnerTime(), 'younger', 'dinner', 'dishes', 'bath', 'bag');
    const urgent = withOpen(base, 'fever');
    expect(urgent.at).not.toBe('table');
    expect(choreAt({ ...urgent, at: 'table' })).toBeNull();
  });
});
