import { dayProgress } from '../engine/clock';
import { activeTask, kidZone, needsAttention, openViews } from '../engine/game';
import { TASK_ZONE, ZONES } from '../engine/world';
import {
  KID_IDS,
  type GameEvent,
  type GameState,
  type KidId,
  type KidState,
  type Style,
  type TaskId,
  type ZoneId,
} from '../engine/types';

/**
 * The pure bridge between the game and the 3D stage. Everything the renderer
 * needs is derived here from `GameState`, so it can be tested without WebGL.
 */

export { TASK_ZONE, ZONES };
export type { ZoneId };

/** What a character's body is doing. */
export const POSE_IDS = ['idle', 'eat', 'write', 'wash', 'bathe', 'pack', 'sulk', 'cheer', 'rest'] as const;
export type Pose = (typeof POSE_IDS)[number];

export const TASK_POSE: Readonly<Record<TaskId, Pose>> = {
  breakfast: 'eat',
  lunch: 'eat',
  dinner: 'eat',
  homework: 'write',
  dishes: 'wash',
  bath: 'bathe',
  bag: 'pack',
};

/** Below this mood a kid sulks even when nothing just happened to them. */
export const SULK_MOOD = 30;

/** What the parent just did, and to whom. Cleared when the next event is drawn. */
export interface Reaction {
  readonly kids: readonly KidId[];
  readonly style: Style | 'breathe';
}

export interface KidView {
  readonly zone: ZoneId;
  readonly pose: Pose;
  /** 0-100, drives the face. */
  readonly mood: number;
}

/** A "!" floating over a room. Red ones must be handled before anything else. */
export interface Marker {
  readonly zone: ZoneId;
  readonly kind: 'urgent' | 'event' | 'kid';
}

export interface SceneView {
  readonly clock: number;
  readonly kids: Readonly<Record<KidId, KidView>>;
  readonly markers: readonly Marker[];
  /** The room to draw a guide ring in, or null. */
  readonly target: ZoneId | null;
  /** The kid the parent is talking to, so the parent turns to face them. */
  readonly focus: KidId | null;
}

/** Pose for a kid given their state and, if any, how the parent just treated them. */
export function poseFor(kid: KidState, clock: number, reacted: Style | 'breathe' | null): Pose {
  const task = activeTask(kid, clock);
  if (task === null) return 'rest';
  switch (reacted) {
    case 'nag':
      return 'sulk';
    case 'together':
    case 'offer_choice':
      return 'cheer';
    case 'do_for':
      return 'idle';
    case 'wait':
    case 'breathe':
    case null:
      return kid.mood < SULK_MOOD ? 'sulk' : TASK_POSE[task];
  }
}

/** Who an event is about: both kids for a family event, otherwise the one kid. */
export function eventKids(event: GameEvent): readonly KidId[] {
  return event.target.kind === 'family' ? KID_IDS : [event.target.kid];
}

/**
 * The reaction to show after the player acts on `event`. Throws if the choice id is
 * not one the event offered, which would mean the UI and engine disagree.
 */
export function reactionFor(event: GameEvent, action: string): Reaction {
  if (action === 'breathe') return { kids: eventKids(event), style: 'breathe' };
  const choice = event.choices.find((c) => c.id === action);
  if (choice === undefined) {
    throw new RangeError(`Event "${event.id}" has no choice "${action}"`);
  }
  return { kids: eventKids(event), style: choice.style };
}

/** Every "!" to show: open events (red when urgent) and kids who have waited too long. */
export function markersFor(game: GameState): readonly Marker[] {
  const markers: Marker[] = openViews(game).map((view) => ({
    zone: view.zone,
    kind: view.urgent ? 'urgent' : 'event',
  }));
  for (const id of KID_IDS) {
    if (!needsAttention(game, id)) continue;
    const zone = kidZone(game.kids[id], game.clock, id);
    if (!markers.some((marker) => marker.zone === zone)) markers.push({ zone, kind: 'kid' });
  }
  return markers;
}

/** Derives the full stage view. `reaction` is non-null while the outcome text is on screen. */
export function deriveScene(game: GameState, reaction: Reaction | null, target: ZoneId | null): SceneView {
  const kids = {} as Record<KidId, KidView>;
  for (const id of KID_IDS) {
    const kid = game.kids[id];
    const reacted = reaction !== null && reaction.kids.includes(id) ? reaction.style : null;
    kids[id] = {
      zone: kidZone(kid, game.clock, id),
      pose: poseFor(kid, game.clock, reacted),
      mood: kid.mood,
    };
  }
  const talkingTo = game.pending?.event.target;
  const focus =
    talkingTo !== undefined && talkingTo.kind !== 'family'
      ? talkingTo.kid
      : reaction !== null && reaction.kids.length === 1
        ? (reaction.kids[0] ?? null)
        : null;
  return { clock: game.clock, kids, markers: markersFor(game), target, focus };
}

export interface Sky {
  /** Hex colours for the window gradient and scene background. */
  readonly top: number;
  readonly bottom: number;
  /** Strength of the sun-like directional light, 0..1. */
  readonly daylight: number;
  /** Strength of the warm indoor lamp, 0..1. */
  readonly lamp: number;
}

/** Morning, noon, afternoon, dusk and night across 07:00 to 21:00. */
const SKY_STOPS: readonly { readonly at: number; readonly sky: Sky }[] = [
  { at: 0, sky: { top: 0x8fc4f0, bottom: 0xfbe3b0, daylight: 0.85, lamp: 0.1 } },
  { at: 0.35, sky: { top: 0x6db3f2, bottom: 0xcfe8ff, daylight: 1, lamp: 0 } },
  { at: 0.6, sky: { top: 0x7fb0e6, bottom: 0xf9d9a0, daylight: 0.85, lamp: 0.1 } },
  { at: 0.75, sky: { top: 0x6f7fb8, bottom: 0xf0b27a, daylight: 0.5, lamp: 0.5 } },
  { at: 0.88, sky: { top: 0x39407a, bottom: 0xb86f7a, daylight: 0.25, lamp: 0.85 } },
  { at: 1, sky: { top: 0x0d1030, bottom: 0x2a2250, daylight: 0.08, lamp: 1 } },
];

const channel = (hex: number, shift: number): number => (hex >> shift) & 0xff;

function mixHex(a: number, b: number, t: number): number {
  const mixed = [16, 8, 0].map((shift) =>
    Math.round(channel(a, shift) + (channel(b, shift) - channel(a, shift)) * t),
  );
  return ((mixed[0] ?? 0) << 16) | ((mixed[1] ?? 0) << 8) | (mixed[2] ?? 0);
}

/** Sky and lighting for a clock value, interpolated between the day's stops. */
export function skyAt(clock: number): Sky {
  const progress = dayProgress(clock);
  const last = SKY_STOPS[SKY_STOPS.length - 1];
  for (let i = 1; i < SKY_STOPS.length; i += 1) {
    const from = SKY_STOPS[i - 1];
    const to = SKY_STOPS[i];
    if (from === undefined || to === undefined || progress > to.at) continue;
    const t = (progress - from.at) / (to.at - from.at);
    return {
      top: mixHex(from.sky.top, to.sky.top, t),
      bottom: mixHex(from.sky.bottom, to.sky.bottom, t),
      daylight: from.sky.daylight + (to.sky.daylight - from.sky.daylight) * t,
      lamp: from.sky.lamp + (to.sky.lamp - from.sky.lamp) * t,
    };
  }
  if (last === undefined) throw new RangeError('SKY_STOPS is empty');
  return last.sky;
}

/** Wall-clock hand angles in radians, clockwise from 12 o'clock. */
export function clockHands(clock: number): { readonly hour: number; readonly minute: number } {
  const minutes = clock % 60;
  const hours = Math.floor(clock / 60) % 12;
  return {
    minute: (minutes / 60) * Math.PI * 2,
    hour: ((hours + minutes / 60) / 12) * Math.PI * 2,
  };
}
