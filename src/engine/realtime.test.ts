import { describe, expect, it } from 'vitest';
import { MESS_EVENTS } from '../data/deck';
import { CARE, CARE_INTERRUPT_CHANCE, CHORES, IGNORED_CALL_PATIENCE, TASK_DUE_AFTER, TASK_RELEASE } from './constants';
import { InvalidActionError, act, createGame } from './game';
import { todoList } from './todo';
import type { GameState, ZoneId } from './types';

const at = (game: GameState, zone: ZoneId | null): GameState => act(game, { kind: 'arrive', zone });
const isMess = (id: string): boolean => MESS_EVENTS.some((event) => event.id === id);
const messOpen = (game: GameState): number => game.open.filter((open) => isMess(open.eventId)).length;

function atDinner(): GameState {
  const game = createGame(1);
  return { ...game, clock: TASK_RELEASE.dinner, kids: {
    elder: { ...game.kids.elder, progress: { ...game.kids.elder.progress, breakfast: 100, lunch: 100, homework: 100 } },
    younger: { ...game.kids.younger, progress: { ...game.kids.younger.progress, breakfast: 100, lunch: 100, homework: 100 } },
  } };
}

describe('real time: the clock moves on its own', () => {
  it('charges exactly the whole minutes it is given', () => {
    const game = createGame(1);
    expect(act(game, { kind: 'tick', minutes: 7 }).clock).toBe(game.clock + 7);
    expect(act(game, { kind: 'tick', minutes: 0 })).toEqual(game);
  });

  it('rejects fractions and negative time', () => {
    const game = createGame(1);
    expect(() => act(game, { kind: 'tick', minutes: 1.5 })).toThrow(InvalidActionError);
    expect(() => act(game, { kind: 'tick', minutes: -1 })).toThrow(InvalidActionError);
  });

  it('wears the parent down while nothing is being done', () => {
    const game = createGame(1);
    const later = act(game, { kind: 'tick', minutes: 120 });
    expect(later.energy).toBeLessThan(game.energy);
    expect(later.bladder).toBeGreaterThan(game.bladder);
    expect(later.fullness).toBeLessThan(game.fullness);
  });

  it('is refused while a conversation is open', () => {
    const talking = { ...createGame(1), pending: { event: { ...createGame(1) } as never, zone: 'sofa' as ZoneId, openEventId: null } };
    expect(() => act(talking, { kind: 'tick', minutes: 1 })).toThrow(InvalidActionError);
  });
});

describe('household mishaps', () => {
  it('keep arriving through the day even when every task is on track', () => {
    let total = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      let game = createGame(seed);
      const seen = new Set<string>();
      for (let m = 0; m < 600 && !game.finished; m += 1) {
        game = act(game, { kind: 'tick', minutes: 1 });
        for (const open of game.open) if (isMess(open.eventId)) seen.add(open.eventId);
      }
      total += seen.size;
    }
    expect(total / 20).toBeGreaterThan(3);
  });

  it('never pile up beyond the cap on their own', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      let game = createGame(seed);
      for (let m = 0; m < 400 && !game.finished; m += 1) {
        game = act(game, { kind: 'tick', minutes: 1 });
        expect(messOpen(game)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('only ever have one red alarm at a time', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      let game = createGame(seed);
      for (let m = 0; m < 400 && !game.finished; m += 1) {
        game = act(game, { kind: 'tick', minutes: 1 });
        expect(game.open.filter((open) => MESS_EVENTS.find((e) => e.id === open.eventId)?.urgent === true).length).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('being cut short', () => {
  /** A seed where the very next break is interrupted, and one where it is not. */
  function sofaWithRoll(interrupted: boolean): GameState {
    for (let seed = 1; seed < 400; seed += 1) {
      const game = { ...at(createGame(seed), 'sofa'), energy: 20, patience: 40 };
      const after = act(game, { kind: 'care', care: 'rest' });
      const cut = after.log.at(-1)?.text.includes('\n') === true || after.log.some((l) => l.actionId === 'rest' && l.text.includes('\n'));
      if (cut === interrupted) return game;
    }
    throw new RangeError('no seed found');
  }

  it('gives a rest that is interrupted only half of its benefit, and a mess to deal with', () => {
    const cutGame = sofaWithRoll(true);
    const calmGame = sofaWithRoll(false);
    const cut = act(cutGame, { kind: 'care', care: 'rest' });
    const calm = act(calmGame, { kind: 'care', care: 'rest' });
    expect(cut.energy - cutGame.energy).toBeLessThan(calm.energy - calmGame.energy);
    expect(cut.energy - cutGame.energy).toBeGreaterThan(0);
    expect(cut.clock - cutGame.clock).toBeLessThan(calm.clock - calmGame.clock);
    expect(messOpen(cut)).toBeGreaterThan(messOpen(cutGame));
  });

  it('happens often for rests, since sitting down is when kids call', () => {
    expect(CARE_INTERRUPT_CHANCE.rest).toBeGreaterThan(0.4);
    expect(CARE.rest.minutes).toBeGreaterThan(1);
  });

  it('halves the progress of a chore answered halfway, and still leaves a mess', () => {
    const game = at(atDinner(), 'table');
    const whole = act(game, { kind: 'chore', score: 1 });
    const answered = act(game, { kind: 'chore', score: 1, interrupt: 'answered' });
    expect(answered.kids.elder.progress.dinner).toBeLessThan(whole.kids.elder.progress.dinner);
    expect(answered.kids.elder.progress.dinner).toBeGreaterThan(0);
    expect(answered.clock).toBeLessThan(whole.clock);
    expect(messOpen(answered)).toBeGreaterThan(0);
  });

  it('costs patience and mood to ignore a call for help in the middle of a chore', () => {
    const game = at(atDinner(), 'table');
    const calm = act(game, { kind: 'chore', score: 1 });
    const ignored = act(game, { kind: 'chore', score: 1, interrupt: 'ignored' });
    expect(ignored.patience).toBeLessThanOrEqual(calm.patience - IGNORED_CALL_PATIENCE + 1);
    expect(ignored.kids.elder.mood).toBeLessThan(calm.kids.elder.mood);
    expect(ignored.kids.elder.progress.dinner).toBe(calm.kids.elder.progress.dinner);
    expect(ignored.clock).toBe(calm.clock);
    expect(CHORES.dinner.minutes).toBeGreaterThan(0);
  });
});

describe('overdue tasks', () => {
  it('sour a waiting kid steadily once the due time has passed', () => {
    const game = { ...atDinner(), open: [] };
    const due = TASK_RELEASE.dinner + TASK_DUE_AFTER.dinner;
    const onTime = act({ ...game, clock: due - 20 }, { kind: 'tick', minutes: 10 });
    const late = act({ ...game, clock: due + 5 }, { kind: 'tick', minutes: 10 });
    expect(game.kids.elder.mood - onTime.kids.elder.mood).toBeLessThan(game.kids.elder.mood - late.kids.elder.mood);
  });
});

describe('the to-do list', () => {
  it('is empty when the day is over', () => {
    expect(todoList({ ...createGame(1), finished: true })).toEqual([]);
  });

  it('lists a kid waiting on a task with a countdown to its due time', () => {
    const items = todoList({ ...atDinner(), open: [] });
    const elder = items.find((item) => item.key === 'task:elder:dinner');
    expect(elder?.left).toBe(TASK_DUE_AFTER.dinner);
    expect(elder?.zone).toBe('table');
    expect(elder?.progress).toBe(0);
  });

  it('puts red alarms first, then the soonest to run out', () => {
    const base = { ...atDinner(), open: [
      { eventId: 'mess-snack', appeared: 0, expires: atDinner().clock + 30 },
      { eventId: 'mess-milk', appeared: 0, expires: atDinner().clock + 10 },
      { eventId: 'mess-bowl', appeared: 0, expires: atDinner().clock + 18 },
    ] };
    const keys = todoList(base).map((item) => item.key);
    expect(keys.slice(0, 3)).toEqual(['event:mess-bowl', 'event:mess-milk', 'event:mess-snack']);
  });

  it('adds the parent\'s own body when it is nearly breaking', () => {
    const items = todoList({ ...createGame(1), bladder: 90, fullness: 5, energy: 10 });
    expect(items.filter((item) => item.kind === 'body').map((item) => item.key).sort()).toEqual([
      'body:eat',
      'body:rest',
      'body:toilet',
    ]);
  });
});
