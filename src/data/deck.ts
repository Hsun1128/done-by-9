import type { GameEvent } from '../engine/types';
import { CHECKIN_EVENTS, checkinFor } from './checkins';
import { DAYTIME_EVENTS } from './daytime';
import { ERRAND_EVENTS } from './errands';
import { INTERRUPTION_EVENTS } from './interruptions';

export { checkinFor };

/** Scripted events that appear on their own through the day. */
export const SPAWNABLE_EVENTS: readonly GameEvent[] = [...DAYTIME_EVENTS, ...INTERRUPTION_EVENTS, ...ERRAND_EVENTS];

/** Every event in the game. */
export const ALL_EVENTS: readonly GameEvent[] = [...CHECKIN_EVENTS, ...SPAWNABLE_EVENTS];

const INDEX: ReadonlyMap<string, GameEvent> = new Map(ALL_EVENTS.map((event) => [event.id, event]));

/** Looks an event up by id. Throws when the id is unknown: that is a bug in the caller. */
export function eventById(id: string): GameEvent {
  const event = INDEX.get(id);
  if (event === undefined) throw new RangeError(`Unknown event id "${id}"`);
  return event;
}
