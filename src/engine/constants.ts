import type { CareId, MinigameId, TaskId, ZoneId } from './types';

/** Every tunable number in the game lives here, named and documented. */

/** 07:00, in minutes since midnight: breakfast for everyone. */
export const DAY_START_MIN = 7 * 60;
/** 21:00: your partner is home from work. The game ends when the clock reaches this or every task is done. */
export const DAY_END_MIN = 21 * 60;

/** When each task can begin. Before this a kid is playing, not waiting for the parent. */
export const TASK_RELEASE: Readonly<Record<TaskId, number>> = {
  breakfast: 7 * 60,
  lunch: 12 * 60,
  homework: 15 * 60,
  dinner: 18 * 60,
  dishes: 18 * 60 + 45,
  bath: 19 * 60 + 15,
  bag: 20 * 60,
};

// --- Starting values -------------------------------------------------------
export const PATIENCE_START = 100;
export const ENERGY_START = 80;
/** The parent has not eaten: dinner is for the kids first. */
export const FULLNESS_START = 35;
export const BLADDER_START = 25;
export const MOOD_START = 70;
export const DISCIPLINE_START = 40;
export const BOND_START = 50;
/** NT$ of flexible budget left this week. */
export const MONEY_START = 1500;

// --- Walking ---------------------------------------------------------------
/** Room units walked per game minute. Crossing the home (about 7 units) takes about 3 minutes. */
export const WALK_UNITS_PER_MINUTE = 4.5;

// --- The parent's body -----------------------------------------------------
export const ENERGY_DECAY_PER_MIN = 0.07;
export const FULLNESS_DECAY_PER_MIN = 0.2;
/** Below this fullness the parent is hungry and energy drains faster. */
export const HUNGRY_BELOW = 20;
export const HUNGRY_ENERGY_DRAIN_PER_MIN = 0.04;
/** Bladder pressure gained per game minute. Over a whole evening it reaches the top without a break. */
export const BLADDER_RISE_PER_MIN = 0.3;
/** From this pressure on the parent is distracted: gentle styles work worse. */
export const BLADDER_DISTRACTED = 75;
/** The body forces a break at 100: this many minutes away from the kids, and a patience hit. */
export const FORCED_BREAK_MINUTES = 8;
export const FORCED_BREAK_PATIENCE_COST = 5;
export const FORCED_BREAK_RESET = 8;
/** Below this pressure a bathroom visit would not help. */
export const TOILET_USEFUL_ABOVE = 30;
export const COLLAPSE_MINUTES = 20;
export const COLLAPSE_ENERGY_GAIN = 35;
export const COLLAPSE_MOOD_COST = 6;
/** The second time the body gives out, the evening ends early. */
export const MAX_COLLAPSES = 2;
/** Below this energy the parent is too tired to do gentle styles well. */
export const FRAZZLED_ENERGY = 25;

// --- Patience and money ----------------------------------------------------
/** Below this patience, gentle styles work worse: you are too frazzled to do them well. */
export const PATIENCE_LOW = 30;
export const LOW_PATIENCE_PENALTY = 0.6;
/** Spending that leaves the budget under this gets a patience cost: you are doing sums while talking. */
export const MONEY_STRESS_BELOW = 500;
export const MONEY_STRESS_PATIENCE_COST = 2;
/** Spending into the negative (the credit card) costs more patience. */
export const MONEY_DEBT_PATIENCE_COST = 4;

// --- Kids ------------------------------------------------------------------
/** Below this mood, a kid resists: progress is reduced for every style except doing it for them. */
export const MOOD_LOW = 30;
export const LOW_MOOD_PENALTY = 0.7;
/** Minutes without the parent before a kid starts to wait and a "!" appears over them. */
export const ATTENTION_AFTER_MIN = 40;
/** Mood lost per minute once a kid has waited longer than the grace period. */
export const UNATTENDED_MOOD_LOSS_PER_MIN = 0.05;
/** Progress per minute a kid makes alone, before scaling by discipline (50 = x1) and mood. */
export const PASSIVE_PROGRESS_PER_MIN = 0.1;
export const PASSIVE_LOW_MOOD_FACTOR = 0.3;

// --- Events ----------------------------------------------------------------
/** Chance per game minute that an eligible scripted event appears. */
export const SPAWN_CHANCE_PER_MIN = 0.055;
export const MAX_OPEN_EVENTS = 4;
/** A routine check-in shows this many of the five styles, chosen at random. */
export const CHECKIN_CHOICE_COUNT = 4;

export const BREATH_PATIENCE_GAIN = 15;
export const BREATH_MINUTES = 3;

// --- Endings ---------------------------------------------------------------
export const QUIET_MIN_DISCIPLINE = 55;
export const QUIET_MIN_MOOD = 60;
export const LATE_MIN_MOOD = 50;
/** A style must be used this many times to count as a "technique" on the result screen. */
export const TECHNIQUE_MIN_USES = 2;
/** Most loose ends shown on the result screen. */
export const MAX_TOMORROW_SHOWN = 5;

// --- Looking after yourself ------------------------------------------------
export interface CareSpec {
  /** The only room where this can be done. */
  readonly zone: ZoneId;
  readonly minutes: number;
  readonly energy: number;
  readonly patience: number;
  readonly fullness: number;
  /** A finished kid on the sofa adds bond; others ignore this. */
  readonly bond: number;
  /** Change in bladder pressure (negative relieves it). */
  readonly bladder: number;
}

export const CARE: Readonly<Record<CareId, CareSpec>> = {
  eat: { zone: 'table', minutes: 6, energy: 6, patience: 2, fullness: 45, bond: 0, bladder: 3 },
  rest: { zone: 'sofa', minutes: 10, energy: 16, patience: 8, fullness: 0, bond: 2, bladder: 2 },
  coffee: { zone: 'sink', minutes: 4, energy: 10, patience: 3, fullness: 0, bond: 0, bladder: 15 },
  toilet: { zone: 'tub', minutes: 4, energy: 0, patience: 5, fullness: 0, bond: 0, bladder: -100 },
};

/** Past this many coffees the next one does nothing: the evening is long enough already. */
export const MAX_COFFEES = 2;

/** Minutes a kid plays in one spot before wandering to the next. */
export const IDLE_BLOCK_MIN = 40;

/** What doing a chore by hand costs and earns. `progress` is `base` at a score of 0 and `base + bonus` at 1. */
export interface ChoreSpec {
  readonly game: MinigameId;
  readonly minutes: number;
  readonly energy: number;
  readonly base: number;
  readonly bonus: number;
  /** Discipline a kid gains when you do this with them instead of for them. */
  readonly discipline: number;
}

export const CHORES: Readonly<Record<TaskId, ChoreSpec>> = {
  breakfast: { game: 'cook', minutes: 17, energy: -4, base: 25, bonus: 45, discipline: 0 },
  lunch: { game: 'cook', minutes: 17, energy: -4, base: 25, bonus: 45, discipline: 0 },
  dinner: { game: 'cook', minutes: 22, energy: -5, base: 25, bonus: 45, discipline: 0 },
  homework: { game: 'quiz', minutes: 19, energy: -4, base: 20, bonus: 42, discipline: 3 },
  dishes: { game: 'scrub', minutes: 17, energy: -5, base: 26, bonus: 46, discipline: 0 },
  bath: { game: 'scrub', minutes: 19, energy: -5, base: 24, bonus: 46, discipline: 0 },
  bag: { game: 'pack', minutes: 10, energy: -2, base: 28, bonus: 46, discipline: -1 },
};

/** Mood a kid gains from a well-done chore, and loses from a botched one. */
export const CHORE_MOOD_SWING = 6;
/** Patience change at a score of 1 (and the mirror image at 0). */
export const CHORE_PATIENCE_SWING = 3;
