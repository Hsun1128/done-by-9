import { OBSTACLES, START_POINT, WALK_BOUNDS, ZONES, distance, type Box, type Point } from './world';
import type { ZoneId } from './types';

/** Walls, furniture and routes around them. Pure geometry shared by the engine (walking time) and the stage. */

/** How wide the parent is. Furniture boxes are grown by this much before collision. */
export const PLAYER_RADIUS = 0.3;

const insideBox = (p: Point, box: Box, grow: number): boolean =>
  p.x > box.minX - grow && p.x < box.maxX + grow && p.z > box.minZ - grow && p.z < box.maxZ + grow;

/** True when a parent standing at `p` would be inside a wall or a piece of furniture. */
export function isBlocked(p: Point): boolean {
  if (
    p.x < WALK_BOUNDS.minX + PLAYER_RADIUS ||
    p.x > WALK_BOUNDS.maxX - PLAYER_RADIUS ||
    p.z < WALK_BOUNDS.minZ + PLAYER_RADIUS ||
    p.z > WALK_BOUNDS.maxZ - PLAYER_RADIUS
  ) {
    return true;
  }
  return OBSTACLES.some((box) => insideBox(p, box, PLAYER_RADIUS));
}

/** Closest point to `p` that the parent can stand on, searching outward in small steps. */
export function nearestFree(p: Point): Point {
  if (!isBlocked(p)) return p;
  for (let radius = 0.1; radius < 3; radius += 0.1) {
    for (let i = 0; i < 16; i += 1) {
      const angle = (i / 16) * Math.PI * 2;
      const candidate = { x: p.x + Math.cos(angle) * radius, z: p.z + Math.sin(angle) * radius };
      if (!isBlocked(candidate)) return candidate;
    }
  }
  return p;
}

/** True when the segment a-b crosses the furniture box grown by `grow` (slab method). */
function segmentHitsBox(a: Point, b: Point, box: Box, grow: number): boolean {
  const minX = box.minX - grow;
  const maxX = box.maxX + grow;
  const minZ = box.minZ - grow;
  const maxZ = box.maxZ + grow;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const [origin, delta, lo, hi] of [
    [a.x, dx, minX, maxX],
    [a.z, dz, minZ, maxZ],
  ] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (origin <= lo || origin >= hi) return false;
    } else {
      let ta = (lo - origin) / delta;
      let tb = (hi - origin) / delta;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 >= t1) return false;
    }
  }
  return true;
}

/** True when the straight segment between two points stays on free floor. */
function clearLine(a: Point, b: Point): boolean {
  const inBounds = (p: Point): boolean => !isBlocked(p);
  if (!inBounds(a) || !inBounds(b)) return false;
  return !OBSTACLES.some((box) => segmentHitsBox(a, b, box, PLAYER_RADIUS));
}

/** Corners of every wall and piece of furniture, pushed just outside the collision margin. */
const CORNERS: readonly Point[] = OBSTACLES.flatMap((box) => {
  const m = PLAYER_RADIUS + 0.06;
  return [
    { x: box.minX - m, z: box.minZ - m },
    { x: box.maxX + m, z: box.minZ - m },
    { x: box.minX - m, z: box.maxZ + m },
    { x: box.maxX + m, z: box.maxZ + m },
  ];
}).filter((p) => !isBlocked(p));

/** Visibility between corners never changes, so it is computed once. */
const CORNER_LINKS: readonly (readonly number[])[] = CORNERS.map((a, i) =>
  CORNERS.flatMap((b, j) => (i !== j && clearLine(a, b) ? [j] : [])),
);

/**
 * A route from `from` to `to` that goes around walls and furniture: the shortest path through
 * the obstacle corners (Dijkstra over a visibility graph). The last point is always `to`.
 */
export function planPath(from: Point, to: Point): readonly Point[] {
  if (clearLine(from, to)) return [to];
  // Node layout: 0 = from, 1..n = corners, n+1 = to.
  const n = CORNERS.length;
  const goal = n + 1;
  const pointOf = (i: number): Point => (i === 0 ? from : i === goal ? to : (CORNERS[i - 1] ?? to));
  const best = new Array<number>(n + 2).fill(Number.POSITIVE_INFINITY);
  const previous = new Array<number>(n + 2).fill(-1);
  const done = new Array<boolean>(n + 2).fill(false);
  best[0] = 0;
  const neighbours = (i: number): readonly number[] => {
    if (i === 0) return [...CORNERS.keys()].filter((c) => clearLine(from, CORNERS[c] ?? from)).map((c) => c + 1).concat(clearLine(from, to) ? [goal] : []);
    const links = (CORNER_LINKS[i - 1] ?? []).map((c) => c + 1);
    const corner = CORNERS[i - 1];
    return corner !== undefined && clearLine(corner, to) ? [...links, goal] : links;
  };
  for (;;) {
    let current = -1;
    for (let i = 0; i < n + 2; i += 1) {
      if (!done[i] && (current === -1 || (best[i] ?? Infinity) < (best[current] ?? Infinity))) current = i;
    }
    if (current === -1 || (best[current] ?? Infinity) === Number.POSITIVE_INFINITY) break;
    done[current] = true;
    if (current === goal) break;
    const here = pointOf(current);
    for (const next of neighbours(current)) {
      if (done[next]) continue;
      const cost = (best[current] ?? 0) + distance(here, pointOf(next));
      if (cost < (best[next] ?? Infinity)) {
        best[next] = cost;
        previous[next] = current;
      }
    }
  }
  if (previous[goal] === -1) return [to];
  const route: Point[] = [];
  for (let at = goal; at > 0; at = previous[at] ?? -1) {
    if (at === -1) return [to];
    route.unshift(pointOf(at));
  }
  return route;
}

/** Length of a route starting at `from`. */
function routeLength(from: Point, route: readonly Point[]): number {
  let at = from;
  let total = 0;
  for (const point of route) {
    total += distance(at, point);
    at = point;
  }
  return total;
}

/** Real walking distance, round walls and furniture, from where the parent is to a zone. */
export function travelUnits(from: ZoneId | null, to: ZoneId): number {
  const origin = from === null ? START_POINT : ZONES[from].stand;
  return routeLength(origin, planPath(origin, ZONES[to].stand));
}
