import type { KidId, TaskId, ZoneId } from './types';
import { ZONE_IDS } from './types';

/**
 * The home as plain data, shared by the engine (travel cost, interaction range)
 * and the 3D stage (where to draw things). Units are room units; +z is towards the camera.
 */

export interface Point {
  readonly x: number;
  readonly z: number;
}

/** Where kids stand in a zone and which way they face. Two kids share it side by side. */
export interface KidSpot extends Point {
  /** Height of the floor surface the kid stands on. */
  readonly y: number;
  readonly yaw: number;
  readonly spread: 'x' | 'z';
}

export interface ZoneSpec {
  /** Short Traditional-Chinese name shown on the floor label. */
  readonly label: string;
  /** Where the parent stands to use the zone: beside the kids, never in front of their faces. */
  readonly stand: Point;
  readonly kid: KidSpot | null;
}

export const ZONES: Readonly<Record<ZoneId, ZoneSpec>> = {
  table: {
    label: '餐桌',
    stand: { x: -0.2, z: -0.3 },
    kid: { x: -2.2, z: -1.15, y: 0, yaw: 0, spread: 'x' },
  },
  desk: {
    label: '書桌',
    stand: { x: -1.4, z: -1.9 },
    kid: { x: 0.2, z: -2.15, y: 0, yaw: Math.PI - 0.55, spread: 'x' },
  },
  sink: {
    label: '流理台',
    stand: { x: 1.5, z: -1.8 },
    kid: { x: 3.2, z: -2.35, y: 0, yaw: Math.PI + 0.55, spread: 'x' },
  },
  tub: {
    label: '浴室',
    stand: { x: 1.2, z: 1.4 },
    kid: { x: 3.3, z: 1.35, y: 0.18, yaw: 0, spread: 'x' },
  },
  door: {
    label: '玄關',
    stand: { x: -3.0, z: 1.5 },
    kid: { x: -4.0, z: 1.2, y: 0, yaw: -Math.PI / 2, spread: 'z' },
  },
  sofa: {
    label: '沙發',
    stand: { x: -3.6, z: -2.1 },
    kid: { x: -3.4, z: -3.0, y: 0.5, yaw: 0, spread: 'x' },
  },
  ledger: {
    label: '家計桌',
    stand: { x: -0.7, z: 2.1 },
    kid: null,
  },
};

/** The room where each task happens. */
export const TASK_ZONE: Readonly<Record<TaskId, ZoneId>> = {
  breakfast: 'table',
  lunch: 'table',
  homework: 'desk',
  dinner: 'table',
  dishes: 'sink',
  bath: 'tub',
  bag: 'door',
};

/** Which side of a shared zone each kid stands on. */
export const KID_SLOT: Readonly<Record<KidId, number>> = { elder: -0.55, younger: 0.55 };

/** The room point where `kid` stands in `zone`, or null for a room kids never use. */
export function kidPoint(zone: ZoneId, kid: KidId): Point | null {
  const spot = ZONES[zone].kid;
  if (spot === null) return null;
  const offset = KID_SLOT[kid];
  return {
    x: spot.x + (spot.spread === 'x' ? offset : 0),
    z: spot.z + (spot.spread === 'z' ? offset : 0),
  };
}

/** Where the parent starts: the middle of the living room, just inside the front door. */
export const START_POINT: Point = { x: -0.1, z: 1.0 };

/** How close the parent must be to a zone's standing spot to use it. */
export const INTERACT_RADIUS = 1.15;

/** Axis-aligned furniture footprint the parent cannot walk through. */
export interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export const WALK_BOUNDS: Box = { minX: -4.7, maxX: 4.7, minZ: -3.6, maxZ: 3.7 };

export const OBSTACLES: readonly Box[] = [
  { minX: -3.45, maxX: -0.95, minZ: -0.55, maxZ: 0.75 }, // dining table
  { minX: -1.0, maxX: 1.4, minZ: -3.9, maxZ: -2.8 }, // homework desk
  { minX: 1.7, maxX: 4.7, minZ: -3.95, maxZ: -2.75 }, // kitchen counter
  { minX: 1.95, maxX: 4.65, minZ: 0.5, maxZ: 2.2 }, // bathtub
  { minX: -4.65, maxX: -2.15, minZ: -3.85, maxZ: -2.85 }, // sofa
  { minX: -2.0, maxX: -0.4, minZ: 2.6, maxZ: 3.4 }, // family-budget table
];

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** The zone whose standing spot is nearest to `point` and within reach, or null. */
export function nearestZone(point: Point): ZoneId | null {
  let best: ZoneId | null = null;
  let bestDistance = INTERACT_RADIUS;
  for (const id of ZONE_IDS) {
    const d = distance(point, ZONES[id].stand);
    if (d <= bestDistance) {
      best = id;
      bestDistance = d;
    }
  }
  return best;
}

/** Straight-line walking distance in room units from where the parent is to a zone. */
export function travelUnits(from: ZoneId | null, to: ZoneId): number {
  const origin = from === null ? START_POINT : ZONES[from].stand;
  return distance(origin, ZONES[to].stand);
}
