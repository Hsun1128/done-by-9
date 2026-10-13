/**
 * The type system is the game's specification. Wrong states (a task event with
 * no kid, progress on a task that is not active, a care action in the wrong
 * room) are made unrepresentable here rather than checked at runtime.
 */

/** `elder` is the first-grader (小一), `younger` is the kindergartner (大班). */
export const KID_IDS = ['elder', 'younger'] as const;
export type KidId = (typeof KID_IDS)[number];

/** Tasks are done in this order, per kid. The first incomplete one is next; it is "active" once its release time has come. */
export const TASK_ORDER = ['breakfast', 'lunch', 'homework', 'dinner', 'dishes', 'bath', 'bag'] as const;
export type TaskId = (typeof TASK_ORDER)[number];

/** How the parent responds. Each style trades speed against self-discipline. */
export const STYLE_IDS = ['nag', 'do_for', 'offer_choice', 'wait', 'together'] as const;
export type Style = (typeof STYLE_IDS)[number];

/** Rooms of the home. One per task, plus the sofa (rest) and the family-budget table. */
export const ZONE_IDS = ['table', 'desk', 'sink', 'tub', 'door', 'sofa', 'ledger'] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Things the parent can do for themselves. Each is available in exactly one room. */
export const CARE_IDS = ['eat', 'rest', 'coffee', 'toilet'] as const;
export type CareId = (typeof CARE_IDS)[number];

export const ENDING_IDS = ['collapsed', 'chaos', 'late', 'tight', 'rushed', 'quiet'] as const;
export type EndingId = (typeof ENDING_IDS)[number];

/** Changes a choice applies. `mood` is scaled by the kid's temperament. */
export interface Effects {
  readonly patience: number;
  readonly mood: number;
  readonly discipline: number;
  readonly bond: number;
  /** The parent's body. Negative when the choice is physically tiring. */
  readonly energy: number;
}

export interface EventChoice {
  /** Unique across the whole event deck. */
  readonly id: string;
  /** What the parent says or does, in their own words. */
  readonly label: string;
  readonly style: Style;
  /** Game minutes this choice consumes. Always positive. */
  readonly minutes: number;
  /** Base progress (0-100) on the event's task. Ignored unless the target is a task. */
  readonly progress: number;
  readonly effects: Effects;
  /** NT$ added to the budget. Negative means spending. */
  readonly money: number;
  /** A promise or loose end carried to tomorrow, shown on the result screen. */
  readonly tomorrow: string | null;
  /** What happens right after the parent acts. */
  readonly aftermath: string;
}

/** Who an event is about, and therefore whose meters it moves. */
export type EventTarget =
  | { readonly kind: 'task'; readonly kid: KidId; readonly task: TaskId }
  | { readonly kind: 'kid'; readonly kid: KidId }
  | { readonly kind: 'family' };

/** What happens when nobody answers an event before it times out. */
export interface Lapse {
  readonly text: string;
  /** Mood each affected kid loses (a positive amount). */
  readonly mood: number;
  /** Patience the parent loses (a positive amount). */
  readonly patience: number;
  /** NT$ change, e.g. a late fee as a negative number. */
  readonly money: number;
  readonly tomorrow: string | null;
}

export interface GameEvent {
  /** Unique across the whole event deck. */
  readonly id: string;
  /**
   * `interruption` and `errand` events are scripted one-offs that appear on their own;
   * `checkin` events are the routine you start by walking up to a kid.
   */
  readonly kind: 'interruption' | 'errand' | 'checkin';
  readonly title: string;
  readonly body: string;
  readonly target: EventTarget;
  /** Fixed room, or null to use the room of the target. */
  readonly zone: ZoneId | null;
  /** Red events block everything else until handled. */
  readonly urgent: boolean;
  /** Minutes an appearing event waits before it lapses. Irrelevant for check-ins. */
  readonly ttl: number;
  readonly lapse: Lapse;
  /** Minutes-since-midnight range in which the event may appear. */
  readonly window: { readonly from: number; readonly to: number };
  readonly choices: readonly EventChoice[];
}

export interface KidState {
  /** 0-100, visible to the player. */
  readonly mood: number;
  /** 0-100, hidden until the result screen. Rises when kids act on their own. */
  readonly discipline: number;
  /** 0-100 per task. A task is done at 100. */
  readonly progress: Readonly<Record<TaskId, number>>;
  /** Clock value when the parent last did something with this kid. */
  readonly lastAttended: number;
}

/** A scripted event that has appeared and is waiting for the parent to walk over. */
export interface OpenEvent {
  readonly eventId: string;
  readonly appeared: number;
  readonly expires: number;
}

/** The conversation currently on screen. Time is frozen while it is open. */
export interface Encounter {
  /** The event with its choices already shuffled (and trimmed, for check-ins). */
  readonly event: GameEvent;
  readonly zone: ZoneId;
  /** Which open event this answers, or null for a routine check-in. */
  readonly openEventId: string | null;
}

export type LogStyle = Style | 'breathe' | 'care' | 'lapse' | 'doze' | 'forced';

export interface LogEntry {
  /** Clock value when the action was taken. */
  readonly clock: number;
  readonly eventId: string;
  /** The choice id, `breathe`, a care id, `lapse` or `doze`. */
  readonly actionId: string;
  readonly style: LogStyle;
  readonly text: string;
  /** NT$ change caused by this entry. */
  readonly money: number;
}

export interface GameState {
  readonly seed: number;
  /** Serializable PRNG state, so a game is fully reproducible from `seed` + actions. */
  readonly rng: number;
  /** Minutes since midnight. */
  readonly clock: number;
  /** Mind: 0-100. Low patience makes gentle styles fail. */
  readonly patience: number;
  /** Body: 0-100. At zero the parent falls asleep on the spot. */
  readonly energy: number;
  /** 0-100. The parent has not eaten; this drains energy when low. */
  readonly fullness: number;
  /** 0-100. Rises all evening and faster with coffee. At 100 the body forces a break. */
  readonly bladder: number;
  readonly bond: number;
  /** Remaining flexible budget this week, NT$. May go negative (card debt). */
  readonly money: number;
  /** Total NT$ spent this evening, for the result screen. */
  readonly spent: number;
  readonly kids: Readonly<Record<KidId, KidState>>;
  /** The room the parent is standing in, or null when walking between rooms. */
  readonly at: ZoneId | null;
  /** Fraction of a game minute already walked but not yet charged. */
  readonly walkRemainder: number;
  readonly open: readonly OpenEvent[];
  /** Ids of scripted events already shown. */
  readonly seenEvents: readonly string[];
  readonly styleCounts: Readonly<Record<Style, number>>;
  readonly breaths: number;
  readonly coffees: number;
  readonly collapses: number;
  /** Times the body forced a bathroom break because the parent never found the time. */
  readonly forcedBreaks: number;
  /** Events that lapsed because nobody answered. */
  readonly missed: number;
  readonly tomorrow: readonly string[];
  readonly pending: Encounter | null;
  readonly log: readonly LogEntry[];
  readonly finished: boolean;
}

export type PlayerAction =
  /** Time passes while the parent walks `units` room units. */
  | { readonly kind: 'walk'; readonly units: number }
  /** The parent stands within reach of `zone`, or of none. Costs no time. */
  | { readonly kind: 'arrive'; readonly zone: ZoneId | null }
  /** Start the conversation available in the current room. */
  | { readonly kind: 'interact' }
  | { readonly kind: 'choose'; readonly choiceId: string }
  | { readonly kind: 'care'; readonly care: CareId }
  | { readonly kind: 'breathe' }
  /** Close the conversation without choosing. Costs no time. */
  | { readonly kind: 'leave' };

/** What pressing the main button would do right now. */
export type Interaction =
  | { readonly kind: 'none' }
  /** An urgent event elsewhere must be handled first. */
  | { readonly kind: 'blocked'; readonly zone: ZoneId; readonly eventId: string }
  | { readonly kind: 'event'; readonly eventId: string; readonly urgent: boolean }
  | { readonly kind: 'checkin'; readonly kid: KidId };

/** Where to send the player next, and why. */
export interface NextUp {
  readonly zone: ZoneId;
  readonly reason: 'urgent' | 'event' | 'kid' | 'body';
  readonly text: string;
}

export interface Summary {
  readonly ending: EndingId;
  readonly allDone: boolean;
  readonly finishClock: number;
  readonly avgMood: number;
  readonly avgDiscipline: number;
  readonly bond: number;
  readonly breaths: number;
  /** Styles the player used at least twice (or the most-used one), most used first. */
  readonly techniques: readonly Style[];
  readonly money: number;
  readonly spent: number;
  readonly missed: number;
  readonly collapses: number;
  readonly forcedBreaks: number;
  /** Loose ends for tomorrow, unique, in the order they happened. */
  readonly tomorrow: readonly string[];
}
