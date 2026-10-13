import type { EndingId } from '../engine/types';

/**
 * Anonymous, best-effort events. There is no user id, no cookie, and nothing
 * about the children: only whether the funnel (start → end → share → cta) works.
 */
export type TrackEvent =
  | { readonly name: 'game_start' }
  | {
      readonly name: 'game_end';
      readonly ending: EndingId;
      readonly allDone: boolean;
      readonly finishClock: number;
      readonly money: number;
      readonly collapses: number;
    }
  | { readonly name: 'share'; readonly method: 'image' | 'native' | 'copy' }
  | { readonly name: 'cta_click' };

export interface Tracker {
  track(event: TrackEvent): void;
}

/** Delivers a JSON body to a URL. Failures are intentionally swallowed: analytics must never break play. */
export type Sender = (url: string, body: string) => void;

export function createTracker(
  endpoint: string | undefined,
  send: Sender,
  now: () => number,
): Tracker {
  return {
    track(event) {
      if (endpoint === undefined) return;
      send(endpoint, JSON.stringify({ v: 1, ts: now(), ...event }));
    },
  };
}

/** Browser sender: `sendBeacon` when available, otherwise a keepalive fetch. */
export const browserSender: Sender = (url, body) => {
  if (typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    return;
  }
  fetch(url, { method: 'POST', body, keepalive: true }).catch(() => undefined);
};
