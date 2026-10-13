import { describe, expect, it } from 'vitest';
import { createTracker } from './analytics';

describe('createTracker', () => {
  it('sends nothing when no endpoint is configured', () => {
    const sent: string[] = [];
    createTracker(undefined, (_url, body) => sent.push(body), () => 1).track({ name: 'game_start' });
    expect(sent).toEqual([]);
  });

  it('sends a versioned, timestamped JSON payload to the endpoint', () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const tracker = createTracker(
      'https://events.example/collect',
      (url, body) => calls.push({ url, body: JSON.parse(body) }),
      () => 1700000000000,
    );
    tracker.track({ name: 'game_end', ending: 'quiet', allDone: true, finishClock: 1250, money: 400, collapses: 0 });
    expect(calls).toEqual([
      {
        url: 'https://events.example/collect',
        body: { v: 1, ts: 1700000000000, name: 'game_end', ending: 'quiet', allDone: true, finishClock: 1250, money: 400, collapses: 0 },
      },
    ]);
  });
});
