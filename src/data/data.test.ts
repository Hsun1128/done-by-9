import { describe, expect, it } from 'vitest';
import { DAY_END_MIN, DAY_START_MIN, TASK_RELEASE } from '../engine/constants';
import { KID_IDS, STYLE_IDS, TASK_ORDER, ZONE_IDS } from '../engine/types';
import { CHECKIN_EVENTS } from './checkins';
import { OPENING_EVENT_ID } from './daytime';
import { ALL_EVENTS, SPAWNABLE_EVENTS, eventById } from './deck';

describe('event deck integrity', () => {
  it('has unique event ids and unique choice ids across the whole deck', () => {
    const ids = ALL_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const choiceIds = ALL_EVENTS.flatMap((e) => e.choices.map((c) => c.id));
    expect(new Set(choiceIds).size).toBe(choiceIds.length);
  });

  it('gives every choice a positive time cost and progress within 0..100', () => {
    for (const event of ALL_EVENTS) {
      for (const choice of event.choices) {
        expect(choice.minutes, `${choice.id} minutes`).toBeGreaterThan(0);
        expect(choice.progress, `${choice.id} progress`).toBeGreaterThanOrEqual(0);
        expect(choice.progress, `${choice.id} progress`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('keeps every scripted event inside the day, in a valid room', () => {
    for (const event of SPAWNABLE_EVENTS) {
      expect(event.window.from, event.id).toBeGreaterThanOrEqual(DAY_START_MIN);
      expect(event.window.to, event.id).toBeLessThanOrEqual(DAY_END_MIN);
      expect(event.window.from, event.id).toBeLessThan(event.window.to);
      if (event.zone !== null) expect(ZONE_IDS, event.id).toContain(event.zone);
      expect(event.ttl, event.id).toBeGreaterThan(0);
    }
  });

  it('only spawns a task event while that task can be active', () => {
    for (const event of SPAWNABLE_EVENTS) {
      if (event.target.kind !== 'task') continue;
      expect(event.window.to, event.id).toBeGreaterThan(TASK_RELEASE[event.target.task]);
    }
  });

  it('offers every scripted event three choices that span at least two styles', () => {
    for (const event of SPAWNABLE_EVENTS) {
      expect(event.choices, event.id).toHaveLength(3);
      expect(new Set(event.choices.map((c) => c.style)).size, event.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('makes urgent events shorter-fused than ordinary ones', () => {
    const urgent = SPAWNABLE_EVENTS.filter((e) => e.urgent);
    expect(urgent.length).toBeGreaterThan(0);
    for (const event of urgent) expect(event.ttl, event.id).toBeLessThanOrEqual(30);
  });

  it('has errands whose choices trade NT$ against minutes', () => {
    const errands = SPAWNABLE_EVENTS.filter((e) => e.kind === 'errand');
    expect(errands.length).toBeGreaterThanOrEqual(10);
    for (const event of errands) {
      const prices = new Set(event.choices.map((c) => `${c.money}/${c.minutes}`));
      expect(prices.size, `${event.id} offers a real trade`).toBeGreaterThan(1);
    }
  });

  it('opens the day with the partner leaving, waiting at the front door', () => {
    const opening = eventById(OPENING_EVENT_ID);
    expect(opening.zone).toBe('door');
    expect(opening.window.from).toBe(DAY_START_MIN);
  });
});

describe('routine check-ins', () => {
  it('exist for every kid and task, each offering all five styles', () => {
    expect(CHECKIN_EVENTS).toHaveLength(KID_IDS.length * TASK_ORDER.length);
    for (const event of CHECKIN_EVENTS) {
      expect(event.choices.map((c) => c.style)).toEqual([...STYLE_IDS]);
    }
  });
});
