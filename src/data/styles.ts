import type { Effects, KidId, Style } from '../engine/types';

export interface StyleBase {
  readonly minutes: number;
  /** Base progress on the active task, before temperament, patience and mood modifiers. */
  readonly progress: number;
  readonly effects: Effects;
}

/**
 * Baseline for routine check-ins. Nagging is fastest and works at first; the
 * gentle styles are slower, cost patience, and build self-discipline.
 */
export const STYLE_BASE: Readonly<Record<Style, StyleBase>> = {
  nag: {
    minutes: 4,
    progress: 70,
    effects: { patience: -1, mood: -10, discipline: -6, bond: -4, energy: -2 },
  },
  do_for: {
    minutes: 7,
    progress: 100,
    effects: { patience: -2, mood: 2, discipline: -8, bond: 0, energy: -4 },
  },
  offer_choice: {
    minutes: 6,
    progress: 45,
    effects: { patience: -3, mood: 4, discipline: 6, bond: 3, energy: -2 },
  },
  wait: {
    minutes: 10,
    progress: 30,
    effects: { patience: -6, mood: 2, discipline: 9, bond: 2, energy: -1 },
  },
  together: {
    minutes: 8,
    progress: 55,
    effects: { patience: -4, mood: 6, discipline: 4, bond: 6, energy: -3 },
  },
};

export interface Temperament {
  /** Multiplier on progress gained. */
  readonly progress: number;
  /** Multiplier on mood change (applies to both gains and losses). */
  readonly mood: number;
}

/** The same technique does not work the same way on both kids. */
export const TEMPERAMENT: Readonly<Record<KidId, Readonly<Record<Style, Temperament>>>> = {
  elder: {
    nag: { progress: 0.7, mood: 1.5 },
    do_for: { progress: 1, mood: 1 },
    offer_choice: { progress: 1.3, mood: 1.2 },
    wait: { progress: 1.2, mood: 1 },
    together: { progress: 0.8, mood: 0.8 },
  },
  younger: {
    nag: { progress: 1, mood: 1.2 },
    do_for: { progress: 1, mood: 1 },
    offer_choice: { progress: 0.75, mood: 1 },
    wait: { progress: 0.6, mood: 1 },
    together: { progress: 1.5, mood: 1.3 },
  },
};
