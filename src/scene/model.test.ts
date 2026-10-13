import { describe, expect, it } from 'vitest';
import { DAY_END_MIN, DAY_START_MIN } from '../engine/constants';
import { checkinFor, eventById } from '../data/deck';
import { createGame } from '../engine/game';
import type { GameEvent, GameState, KidState } from '../engine/types';
import {
  SULK_MOOD,
  clockHands,
  deriveScene,
  poseFor,
  reactionFor,
  skyAt,
  type Reaction,
} from './model';

const ALL_TASKS = { breakfast: 100, lunch: 100, homework: 100, dinner: 100, dishes: 100, bath: 100, bag: 100 };
const doneKid = (kid: KidState): KidState => ({ ...kid, progress: ALL_TASKS });

/** Dinner time: the first three tasks are behind everybody. */
function dinnerTime(): GameState {
  const base = createGame(1);
  const behind = { breakfast: 100, lunch: 100, homework: 100 };
  const kid = (k: KidState): KidState => ({ ...k, progress: { ...k.progress, ...behind }, lastAttended: 18 * 60 });
  return { ...base, clock: 18 * 60, open: [], kids: { elder: kid(base.kids.elder), younger: kid(base.kids.younger) } };
}

describe('poseFor', () => {
  const game = dinnerTime();
  const kid = game.kids.younger;
  const clock = game.clock;

  it('shows the task pose when nothing just happened', () => {
    expect(poseFor(kid, clock, null)).toBe('eat');
  });

  it('shows a sulk after being nagged, however good the mood was', () => {
    expect(poseFor({ ...kid, mood: 90 }, clock, 'nag')).toBe('sulk');
  });

  it('cheers after a gentle style', () => {
    expect(poseFor(kid, clock, 'together')).toBe('cheer');
    expect(poseFor(kid, clock, 'offer_choice')).toBe('cheer');
  });

  it('sulks at rest when the mood is low', () => {
    expect(poseFor({ ...kid, mood: SULK_MOOD - 1 }, clock, null)).toBe('sulk');
    expect(poseFor({ ...kid, mood: SULK_MOOD }, clock, null)).toBe('eat');
  });

  it('rests when the kid has finished everything, or their next task is not due yet', () => {
    expect(poseFor(doneKid(kid), clock, 'nag')).toBe('rest');
    expect(poseFor(createGame(1).kids.younger, 6 * 60, null)).toBe('rest');
  });
});

describe('deriveScene', () => {
  it('puts each kid in the zone of their own task, and playing kids on the sofa', () => {
    const game = dinnerTime();
    const elder = { ...game.kids.elder, progress: { ...game.kids.elder.progress, dinner: 100 } };
    const view = deriveScene({ ...game, clock: 19 * 60, kids: { ...game.kids, elder } }, null, null);
    expect(view.kids.elder.zone).toBe('sink');
    expect(view.kids.younger.zone).toBe('table');
    expect(deriveScene(createGame(1), null, null).kids.elder.zone).toBe('table');
    expect(deriveScene({ ...game, clock: 11 * 60 }, null, null).kids.elder.zone).toBe('sofa');
  });

  it('applies a reaction only to the kids it was aimed at', () => {
    const reaction: Reaction = { kids: ['elder'], style: 'nag' };
    const view = deriveScene(dinnerTime(), reaction, null);
    expect(view.kids.elder.pose).toBe('sulk');
    expect(view.kids.younger.pose).toBe('eat');
  });

  it('marks the front door with a red "!" while the partner waits there at the start', () => {
    expect(deriveScene(createGame(1), null, null).markers).toEqual([{ zone: 'door', kind: 'event' }]);
  });

  it('marks kids who have waited too long, once per room', () => {
    const waited = { ...dinnerTime(), clock: 18 * 60 + 60 };
    const view = deriveScene(waited, null, null);
    expect(view.markers.filter((m) => m.zone === 'table')).toEqual([{ zone: 'table', kind: 'kid' }]);
  });

  it('passes the guide target through', () => {
    expect(deriveScene(createGame(1), null, 'ledger').target).toBe('ledger');
  });

  it('focuses the parent on the kid being talked to, and nobody for family events', () => {
    const game = dinnerTime();
    const encounter = (event: GameEvent): GameState => ({
      ...game,
      pending: { event, zone: 'table', openEventId: null },
    });
    expect(deriveScene(encounter(checkinFor('younger', 'dinner')), null, null).focus).toBe('younger');
    expect(deriveScene(encounter(eventById('grandma-call')), null, null).focus).toBeNull();
  });

  it('focuses the parent on the single kid reacted to when no encounter is open', () => {
    const view = deriveScene(dinnerTime(), { kids: ['younger'], style: 'together' }, null);
    expect(view.focus).toBe('younger');
  });
});

describe('skyAt', () => {
  it('gets darker as the day goes on', () => {
    const noon = skyAt(12 * 60 + 30);
    const dusk = skyAt(19 * 60 + 30);
    const late = skyAt(DAY_END_MIN);
    expect(noon.daylight).toBeGreaterThan(dusk.daylight);
    expect(dusk.daylight).toBeGreaterThan(late.daylight);
    const early = skyAt(DAY_START_MIN);
    expect(early.lamp).toBeLessThan(late.lamp);
  });

  it('clamps outside the day instead of extrapolating', () => {
    expect(skyAt(0)).toEqual(skyAt(DAY_START_MIN));
    expect(skyAt(24 * 60)).toEqual(skyAt(DAY_END_MIN));
  });

  it('always returns channels that fit in 24-bit colour', () => {
    for (let clock = DAY_START_MIN; clock <= DAY_END_MIN; clock += 5) {
      const sky = skyAt(clock);
      expect(sky.top).toBeGreaterThanOrEqual(0);
      expect(sky.top).toBeLessThanOrEqual(0xffffff);
      expect(sky.bottom).toBeLessThanOrEqual(0xffffff);
    }
  });
});

describe('clockHands', () => {
  it('points both hands straight up at 12:00', () => {
    const hands = clockHands(12 * 60);
    expect(hands.minute).toBeCloseTo(0);
    expect(hands.hour).toBeCloseTo(0);
  });

  it('puts the minute hand at 6 and the hour hand halfway to 7 at 18:30', () => {
    const hands = clockHands(18 * 60 + 30);
    expect(hands.minute).toBeCloseTo(Math.PI);
    expect(hands.hour).toBeCloseTo(((6.5 / 12) * Math.PI * 2));
  });
});

describe('reactionFor', () => {
  const crayons = eventById('crayon-fight');
  const eraser = eventById('lost-eraser');

  it('aims a family event at both kids', () => {
    const reaction = reactionFor(crayons, 'crayon-fight:solve');
    expect(reaction.kids).toEqual(['elder', 'younger']);
    expect(reaction.style).toBe('offer_choice');
  });

  it('aims a kid event at that kid only', () => {
    expect(reactionFor(eraser, 'lost-eraser:nag')).toEqual({ kids: ['elder'], style: 'nag' });
  });

  it('treats breathing as a reaction with no style change', () => {
    expect(reactionFor(eraser, 'breathe').style).toBe('breathe');
  });

  it('rejects a choice the event never offered', () => {
    expect(() => reactionFor(eraser, 'nope')).toThrow(RangeError);
  });
});
