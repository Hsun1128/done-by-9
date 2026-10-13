// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../config';
import { SAVE_KEY, loadSave, type StorageLike } from '../storage';
import type { TrackEvent, Tracker } from '../telemetry/analytics';
import type { SceneView } from '../scene/model';
import type { Stage, StageEvents } from '../scene/stage';
import { travelUnits, ZONES } from '../engine/world';
import type { ZoneId } from '../engine/types';
import { mountApp } from './app';
import { silentSound } from './sound';

function memoryStore(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

/** A stage with no WebGL: walking is instant, and the test can see what the app told it. */
function fakeStage(events: StageEvents) {
  let at: ZoneId | null = null;
  const log = { views: [] as SceneView[], frozen: false, lifecycle: [] as string[], resets: 0 };
  const stage: Stage = {
    element: document.createElement('div'),
    update: (view) => {
      log.views.push(view);
    },
    setStick: () => undefined,
    walkTo: (zone) => {
      events.onWalk(travelUnits(at, zone));
      at = zone;
      events.onNear(zone);
    },
    setFrozen: (value) => {
      log.frozen = value;
    },
    reset: () => {
      at = null;
      log.resets += 1;
      events.onNear(null);
    },
    start: () => {
      log.lifecycle.push('start');
    },
    stop: () => {
      log.lifecycle.push('stop');
    },
  };
  return { stage, log, stageEvents: events };
}

let dispose: (() => void) | null = null;

function setup() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const events: TrackEvent[] = [];
  const tracker: Tracker = {
    track: (event) => {
      events.push(event);
    },
  };
  const storage = memoryStore();
  const holder: { fake?: ReturnType<typeof fakeStage> } = {};
  dispose = mountApp({
    root,
    config: parseConfig({}),
    storage,
    tracker,
    createStage: (stageEvents) => {
      const made = fakeStage(stageEvents);
      holder.fake = made;
      return made.stage;
    },
    sound: silentSound,
    nextSeed: () => 2024,
    reducedMotion: () => true,
  });
  if (holder.fake === undefined) throw new Error('The app never built a stage');
  const built = holder.fake;
  return { root, events, storage, ...built };
}

afterEach(() => {
  dispose?.();
  dispose = null;
  document.body.replaceChildren();
});

const click = (root: HTMLElement, selector: string): boolean => {
  const element = root.querySelector<HTMLButtonElement>(selector);
  if (element === null || element.disabled) return false;
  element.click();
  return true;
};

const press = (key: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }));
};

/** Home, then through the narration cards, into the day. */
function startDay(root: HTMLElement): void {
  click(root, '.screen--home .primary');
  for (let i = 0; i < 12 && root.querySelector('.screen--intro') !== null; i += 1) {
    click(root, '.screen--intro .primary');
  }
}

/** Plays like a simple player: go where the guide says, talk, take what is offered. */
function playToEnd(root: HTMLElement): void {
  for (let i = 0; i < 4000; i += 1) {
    if (root.querySelector('.screen--result') !== null) return;
    if (click(root, '.sheet .primary')) continue;
    if (click(root, '.sheet .choice')) continue;
    press('r');
    press('g');
    press('e');
    if (root.querySelector('.sheet') !== null && root.querySelector('.sheet')?.children.length === 0) press('b');
  }
  throw new Error('The day never reached the result screen');
}

describe('app flow', () => {
  it('shows the home screen first, with a start button', () => {
    const { root } = setup();
    expect(root.querySelector('.title')?.textContent).toBe('21:00 前，全部搞定');
    expect(root.querySelector('.primary')?.textContent).toBe('開始這一天');
  });

  it('plays the narration cards before the day, and can be skipped to the end of them', () => {
    const { root, events } = setup();
    click(root, '.screen--home .primary');
    expect(root.querySelector('.screen--intro')).not.toBeNull();
    expect(root.querySelector('.intro__text')?.textContent).toContain('07:00');
    expect(events).toEqual([]);
    startDay(root);
    expect(root.querySelector('.screen--play')).not.toBeNull();
    expect(events).toEqual([{ name: 'game_start' }]);
  });

  it('starts the day at 07:00 with both kids, the budget, four body meters and a "!" at the front door', () => {
    const { root, log } = setup();
    startDay(root);
    expect(root.querySelector('.hud__clock')?.textContent).toBe('07:00');
    expect(root.querySelectorAll('.kid')).toHaveLength(2);
    expect(root.querySelector('.hud__money')?.textContent).toContain('1,500');
    expect(root.querySelectorAll('.meters .meter')).toHaveLength(4);
    expect(root.querySelector('.sheet')?.children).toHaveLength(0);
    expect(log.views.at(-1)?.markers).toEqual([{ zone: 'door', kind: 'event' }]);
  });

  it('walking costs time: the clock moves when the stage reports distance', () => {
    const { root, stageEvents } = setup();
    startDay(root);
    stageEvents.onWalk(30);
    expect(root.querySelector('.hud__clock')?.textContent).toBe('07:10');
  });

  it('ignores walking and proximity reports while a conversation is open', () => {
    const { root, stageEvents } = setup();
    startDay(root);
    press('g');
    press('e');
    stageEvents.onWalk(30);
    expect(root.querySelectorAll('.sheet .choice')).toHaveLength(3);
  });

  it('talking to someone opens a sheet with choices and freezes the parent', () => {
    const { root, log } = setup();
    startDay(root);
    press('g');
    press('e');
    expect(root.querySelectorAll('.sheet .choice')).toHaveLength(3);
    expect(log.frozen).toBe(true);
  });

  it('choosing shows what happened, then continue closes the card and lets the parent move again', () => {
    const { root, log } = setup();
    startDay(root);
    press('g');
    press('e');
    press('1');
    expect(root.querySelector('.outcome__text')?.textContent.length).toBeGreaterThan(0);
    expect(root.querySelector('.sheet .choice')).toBeNull();
    click(root, '.sheet .primary');
    expect(root.querySelector('.sheet')?.children).toHaveLength(0);
    expect(log.frozen).toBe(false);
  });

  it('escape leaves a conversation without spending time', () => {
    const { root } = setup();
    startDay(root);
    press('g');
    const clock = root.querySelector('.hud__clock')?.textContent;
    press('e');
    press('Escape');
    expect(root.querySelector('.sheet')?.children).toHaveLength(0);
    expect(root.querySelector('.hud__clock')?.textContent).toBe(clock);
  });

  it('a whole day ends on the result screen, records progress, and reports the ending', () => {
    const { root, events, storage } = setup();
    startDay(root);
    playToEnd(root);
    expect(root.querySelectorAll('.stat').length).toBeGreaterThanOrEqual(4);
    expect(root.querySelector('.title')?.textContent.length).toBeGreaterThan(0);
    expect(loadSave(storage).plays).toBe(1);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(events.map((e) => e.name)).toEqual(['game_start', 'game_end']);
  });

  it('the call-to-action records interest locally when no link is configured', () => {
    const { root, events, storage } = setup();
    startDay(root);
    playToEnd(root);
    click(root, '.cta .primary');
    expect(events.at(-1)).toEqual({ name: 'cta_click' });
    expect(loadSave(storage).ctaClicks).toBe(1);
    expect(root.querySelector<HTMLButtonElement>('.cta .primary')?.disabled).toBe(true);
  });

  it('replaying starts a fresh day at 07:00 and puts the parent back at the start', () => {
    const { root, log } = setup();
    startDay(root);
    playToEnd(root);
    const resets = log.resets;
    click(root, '.screen--result > .primary');
    expect(root.querySelector('.hud__clock')?.textContent).toBe('07:00');
    expect(log.resets).toBe(resets + 1);
  });

  it('hosts the shared 3D stage on the home and play screens and stops it on the result screen', () => {
    const { root, stage, log } = setup();
    expect(root.contains(stage.element)).toBe(true);
    startDay(root);
    expect(root.contains(stage.element)).toBe(true);
    expect(log.lifecycle.at(-1)).toBe('start');
    playToEnd(root);
    expect(root.contains(stage.element)).toBe(false);
    expect(log.lifecycle.at(-1)).toBe('stop');
  });

  it('knows every zone the guide can send the parent to', () => {
    for (const zone of Object.keys(ZONES)) expect(ZONES[zone as ZoneId].label.length).toBeGreaterThan(0);
  });
});
