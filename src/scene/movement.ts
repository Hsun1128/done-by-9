import { distance, type Point } from '../engine/world';
import { PLAYER_RADIUS, isBlocked, planPath, nearestFree } from '../engine/pathing';

export { PLAYER_RADIUS, isBlocked, nearestFree, planPath };

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
