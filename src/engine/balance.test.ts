import { describe, expect, it } from 'vitest';
import { alwaysStyle, buyTime, handy, playGame, savePennies, selfless, thoughtful, type Bot } from './simulate';
import type { Summary } from './types';

const SEEDS = 40;

function play(bot: Bot): readonly Summary[] {
  return Array.from({ length: SEEDS }, (_, i) => playGame(i + 1, bot).summary);
}

const share = (runs: readonly Summary[], pick: (s: Summary) => boolean): number =>
  runs.filter(pick).length / runs.length;
const mean = (runs: readonly Summary[], pick: (s: Summary) => number): number =>
  runs.reduce((sum, s) => sum + pick(s), 0) / runs.length;

const quiet = (s: Summary): boolean => s.ending === 'quiet';

describe('balance over a whole day, 07:00 to 21:00 (bots play 40 seeded days)', { timeout: 120_000 }, () => {
  const thoughtfulRuns = play(thoughtful);

  it('never rewards nagging or doing everything yourself with a quiet evening', () => {
    expect(share(play(alwaysStyle('nag')), quiet)).toBe(0);
    expect(share(play(alwaysStyle('do_for')), quiet)).toBe(0);
  });

  it('never finishes the day by only waiting', () => {
    expect(share(play(alwaysStyle('wait')), (s) => s.allDone)).toBe(0);
  });

  it('lets no single gentle style win on its own', () => {
    expect(share(play(alwaysStyle('offer_choice')), quiet)).toBeLessThan(0.5);
    expect(share(play(alwaysStyle('together')), quiet)).toBeLessThan(0.2);
  });

  it('rewards reading the situation: mixing styles beats the best single style', () => {
    const best = Math.max(
      ...(['nag', 'do_for', 'offer_choice', 'wait', 'together'] as const).map((style) =>
        share(play(alwaysStyle(style)), quiet),
      ),
    );
    const mixed = share(thoughtfulRuns, quiet);
    expect(mixed).toBeGreaterThan(0.25);
    expect(mixed).toBeGreaterThan(best + 0.05);
  });

  it('makes money trade against time: buying time costs far more than saving pennies', () => {
    const spent = (runs: readonly Summary[]): number => mean(runs, (s) => s.spent);
    expect(spent(play(buyTime))).toBeGreaterThan(spent(play(savePennies)) + 300);
  });

  it('breaks a parent who never looks after themselves, but not one who does', () => {
    expect(mean(play(selfless), (s) => s.collapses)).toBeGreaterThan(0.5);
    expect(mean(thoughtfulRuns, (s) => s.collapses)).toBeLessThan(0.1);
  });

  it('rewards doing chores well: a skilled pair of hands beats a clumsy one, and hopeless ones never win', () => {
    expect(share(play(handy(0.8)), quiet)).toBeGreaterThan(share(play(handy(0.3)), quiet));
    expect(share(play(handy(0)), quiet)).toBe(0);
  });

  it('does not let chores trivialise the day: even perfect play fails often enough to matter', () => {
    expect(share(play(handy(1)), quiet)).toBeLessThan(0.7);
  });
});
