import { OBSTACLES, WALK_BOUNDS, distance, type Box, type Point } from '../engine/world';

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

/**
 * Moves `from` by `delta`, sliding along walls and furniture: if the full move is blocked,
 * each axis is tried on its own. Returns the new position (unchanged if both axes are blocked).
 */
export function moveWithCollision(from: Point, delta: Point): Point {
  const full = { x: from.x + delta.x, z: from.z + delta.z };
  if (!isBlocked(full)) return full;
  const alongX = { x: from.x + delta.x, z: from.z };
  if (!isBlocked(alongX)) return alongX;
  const alongZ = { x: from.x, z: from.z + delta.z };
  if (!isBlocked(alongZ)) return alongZ;
  return from;
}

/** A unit-length (or zero) direction from the pressed movement keys. W/Up is away from the camera. */
export function directionFromKeys(keys: ReadonlySet<string>): Point {
  const pressed = (...names: readonly string[]): boolean => names.some((name) => keys.has(name));
  const x = (pressed('d', 'arrowright') ? 1 : 0) - (pressed('a', 'arrowleft') ? 1 : 0);
  const z = (pressed('s', 'arrowdown') ? 1 : 0) - (pressed('w', 'arrowup') ? 1 : 0);
  const length = Math.hypot(x, z);
  return length === 0 ? { x: 0, z: 0 } : { x: x / length, z: z / length };
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

/** True when the straight segment between two points stays on free floor. */
function clearLine(a: Point, b: Point): boolean {
  const steps = Math.max(2, Math.ceil(distance(a, b) / 0.08));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isBlocked({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false;
  }
  return true;
}

/** Corners of every piece of furniture, pushed just outside the collision margin. */
const CORNERS: readonly Point[] = OBSTACLES.flatMap((box) => {
  const m = PLAYER_RADIUS + 0.06;
  return [
    { x: box.minX - m, z: box.minZ - m },
    { x: box.maxX + m, z: box.minZ - m },
    { x: box.minX - m, z: box.maxZ + m },
    { x: box.maxX + m, z: box.maxZ + m },
  ];
}).filter((p) => !isBlocked(p));

/**
 * A route from `from` to `to` that goes around furniture: the shortest path through the
 * furniture corners (Dijkstra over a visibility graph). The last point is always `to`.
 */
export function planPath(from: Point, to: Point): readonly Point[] {
  if (clearLine(from, to)) return [to];
  const nodes: readonly Point[] = [from, ...CORNERS, to];
  const goal = nodes.length - 1;
  const best = nodes.map(() => Number.POSITIVE_INFINITY);
  const previous = nodes.map(() => -1);
  const done = nodes.map(() => false);
  best[0] = 0;
  for (;;) {
    let current = -1;
    for (let i = 0; i < nodes.length; i += 1) {
      if (!done[i] && (current === -1 || (best[i] ?? Infinity) < (best[current] ?? Infinity))) current = i;
    }
    if (current === -1 || (best[current] ?? Infinity) === Number.POSITIVE_INFINITY) break;
    done[current] = true;
    if (current === goal) break;
    const here = nodes[current];
    if (here === undefined) break;
    for (let i = 0; i < nodes.length; i += 1) {
      const there = nodes[i];
      if (done[i] || there === undefined || !clearLine(here, there)) continue;
      const cost = (best[current] ?? 0) + distance(here, there);
      if (cost < (best[i] ?? Infinity)) {
        best[i] = cost;
        previous[i] = current;
      }
    }
  }
  const route: Point[] = [];
  for (let at = goal; at > 0; at = previous[at] ?? -1) {
    const node = nodes[at];
    if (node === undefined || previous[at] === -1) return [to];
    route.unshift(node);
  }
  return route;
}

export interface Follow {
  readonly position: Point;
  readonly arrived: boolean;
  /** Distance actually covered, in room units. */
  readonly moved: number;
}

/** One step of walking towards `target` at most `maxStep` units, sliding around furniture. */
export function followStep(from: Point, target: Point, maxStep: number): Follow {
  const remaining = distance(from, target);
  if (remaining < 0.05) return { position: target, arrived: true, moved: 0 };
  const step = Math.min(maxStep, remaining);
  const delta = { x: ((target.x - from.x) / remaining) * step, z: ((target.z - from.z) / remaining) * step };
  const position = moveWithCollision(from, delta);
  return { position, arrived: false, moved: distance(from, position) };
}

/** Walks along a planned route; `route` is consumed from the front as waypoints are reached. */
export function followRoute(from: Point, route: readonly Point[], maxStep: number): {
  readonly position: Point;
  readonly route: readonly Point[];
  readonly moved: number;
} {
  const [next, ...rest] = route;
  if (next === undefined) return { position: from, route, moved: 0 };
  const step = followStep(from, next, maxStep);
  return { position: step.position, route: step.arrived ? rest : route, moved: step.moved };
}
