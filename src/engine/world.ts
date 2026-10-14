import type { KidId, TaskId, ZoneId } from './types';
import { ZONE_IDS } from './types';

/**
 * The world as plain data, shared by the engine (travel cost, interaction range) and the 3D
 * stage (where to draw things). Units are metres-ish; +x is east, +z is towards the camera.
 *
 *   home      x -5.3 .. 11.3, z -4.0 .. 6.6
 *     living/dining/kitchen  x -5.0 .. 4.7   (front door on the west wall)
 *     kids' room (north-east) x 5.0 .. 11.0, z -3.7 .. 0.0
 *     bathroom   (south-east) x 5.0 .. 11.0, z 0.3 .. 3.7
 *     balcony    (south)      x -5.0 .. 1.5,  z 3.7 .. 6.3
 *   outside   x -38 .. -5.3: the street, with the market, pharmacy and school on its north side
 *             and the park on its south side
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
  /** Outside the front door: getting there costs a real walk. */
  readonly outdoor: boolean;
}

export const ZONES: Readonly<Record<ZoneId, ZoneSpec>> = {
  table: {
    label: '餐桌',
    stand: { x: -0.2, z: -0.3 },
    kid: { x: -2.2, z: -1.15, y: 0, yaw: 0, spread: 'x' },
    outdoor: false,
  },
  desk: {
    label: '書桌',
    stand: { x: 6.6, z: -1.9 },
    kid: { x: 8.2, z: -2.15, y: 0, yaw: Math.PI - 0.55, spread: 'x' },
    outdoor: false,
  },
  sink: {
    label: '流理台',
    stand: { x: 1.5, z: -1.8 },
    kid: { x: 3.2, z: -2.35, y: 0, yaw: Math.PI + 0.55, spread: 'x' },
    outdoor: false,
  },
  tub: {
    label: '浴室',
    stand: { x: 7.0, z: 2.75 },
    kid: { x: 9.4, z: 2.75, y: 0.18, yaw: -Math.PI / 2, spread: 'z' },
    outdoor: false,
  },
  door: {
    label: '玄關',
    stand: { x: -3.0, z: 1.5 },
    kid: { x: -4.0, z: 1.2, y: 0, yaw: -Math.PI / 2, spread: 'z' },
    outdoor: false,
  },
  sofa: {
    label: '沙發',
    stand: { x: -3.6, z: -2.1 },
    kid: { x: -3.4, z: -3.0, y: 0.5, yaw: 0, spread: 'x' },
    outdoor: false,
  },
  ledger: {
    label: '家計桌',
    stand: { x: -0.7, z: 2.1 },
    kid: null,
    outdoor: false,
  },
  toys: {
    label: '玩具角',
    stand: { x: 6.2, z: -0.55 },
    kid: { x: 7.4, z: -0.5, y: 0, yaw: -Math.PI / 2, spread: 'z' },
    outdoor: false,
  },
  bed: {
    label: '床',
    stand: { x: 9.0, z: -0.95 },
    kid: { x: 10.2, z: -2.1, y: 0.55, yaw: -Math.PI / 2, spread: 'z' },
    outdoor: false,
  },
  laundry: {
    label: '陽台',
    stand: { x: -2.4, z: 5.0 },
    kid: null,
    outdoor: false,
  },
  market: {
    label: '超市',
    stand: { x: -13.4, z: -2.4 },
    kid: null,
    outdoor: true,
  },
  pharmacy: {
    label: '藥局',
    stand: { x: -20.9, z: -2.4 },
    kid: null,
    outdoor: true,
  },
  park: {
    label: '公園',
    stand: { x: -22.0, z: 4.6 },
    kid: null,
    outdoor: true,
  },
  school: {
    label: '學校門口',
    stand: { x: -31.0, z: -2.4 },
    kid: null,
    outdoor: true,
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

/** Where a kid with nothing to do plays. They drift between these through the day. */
export const PLAY_ZONES: readonly ZoneId[] = ['sofa', 'toys'];

/** Which side of a shared zone each kid stands on. */
export const KID_SLOT: Readonly<Record<KidId, number>> = { elder: -0.55, younger: 0.55 };

/** The point where `kid` stands in `zone`, or null for a place kids never use. */
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

/** Axis-aligned footprint the parent cannot walk through: furniture, walls, buildings. */
export interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** The edge of the world. The home's outer walls are obstacles; this is the far boundary. */
export const WALK_BOUNDS: Box = { minX: -38, maxX: 11.6, minZ: -10, maxZ: 11 };

const box = (minX: number, maxX: number, minZ: number, maxZ: number): Box => ({ minX, maxX, minZ, maxZ });

/** Interior and exterior walls of the home. Doorways are the gaps between segments. */
export const WALLS: readonly Box[] = [
  box(-5.3, 11.3, -4.0, -3.7), // north wall, the whole width
  box(11.0, 11.3, -4.0, 4.0), // east wall
  box(-5.3, -5.0, -4.0, 0.45), // west wall, north of the front door
  box(-5.3, -5.0, 1.95, 6.6), // west wall, south of the front door (round the balcony)
  box(4.7, 5.0, -4.0, -2.6), // kids' room wall, north of its door
  box(4.7, 5.0, -1.0, 1.4), // between the kids' room and the bathroom door
  box(4.7, 5.0, 3.0, 4.0), // bathroom wall, south of its door
  box(5.0, 11.3, 0.0, 0.3), // kids' room / bathroom divider
  box(5.0, 11.3, 3.7, 4.0), // bathroom south wall
  box(1.8, 4.7, 3.7, 4.0), // living room south wall, east of the balcony
  box(1.5, 1.8, 3.7, 6.6), // balcony east rail
  box(-5.3, 1.8, 6.3, 6.6), // balcony south rail
];

export const FURNITURE: readonly Box[] = [
  box(-3.45, -0.95, -0.55, 0.5), // dining table (a little smaller than it looks, so the way past it stays open)
  box(1.7, 4.7, -3.95, -2.75), // kitchen counter
  box(-4.65, -2.15, -3.85, -2.85), // sofa
  box(-2.0, -0.4, 2.6, 3.4), // family-budget table
  box(7.0, 9.6, -3.95, -2.8), // homework desk
  box(9.7, 10.95, -3.5, -0.8), // bed
  box(5.5, 6.4, -3.5, -2.7), // bookshelf
  box(7.9, 10.95, 2.0, 3.5), // bathtub
  box(5.4, 6.3, 0.5, 1.4), // toilet
  box(-4.6, -3.3, 4.5, 5.6), // washing machine
  // outside: everything tall is on the north side of the street, so it never hides the parent
  box(-19, -14.6, -8, -1.2), // market
  box(-26.6, -22.2, -8, -1.2), // pharmacy
  box(-37, -32.4, -9, -1.2), // school
  box(-26.9, -25.5, 4.8, 5.6), // park bench
  box(-25.6, -24.4, 6.0, 7.2), // park tree
  box(-20.1, -18.9, 7.6, 8.8), // park tree
  box(-23.4, -22.2, 8.4, 9.6), // park tree
];

export const OBSTACLES: readonly Box[] = [...WALLS, ...FURNITURE];

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
