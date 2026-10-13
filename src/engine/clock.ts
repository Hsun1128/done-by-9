import { DAY_END_MIN, DAY_START_MIN } from './constants';

const pad = (value: number): string => value.toString().padStart(2, '0');

/** Formats minutes-since-midnight as `HH:MM`. */
export function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  return `${pad(hours)}:${pad(minutes % 60)}`;
}

/** Minutes left before 21:00, never negative. */
export function minutesUntilEnd(clock: number): number {
  return Math.max(0, DAY_END_MIN - clock);
}

/** How far through the evening the clock is, clamped to 0..1. */
export function dayProgress(clock: number): number {
  const fraction = (clock - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN);
  return Math.min(1, Math.max(0, fraction));
}
