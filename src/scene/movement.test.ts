import { describe, expect, it } from 'vitest';
import { ZONE_IDS } from '../engine/types';
import { START_POINT, ZONES, distance } from '../engine/world';
import { directionFromKeys, followRoute, isBlocked, moveWithCollision, nearestFree, planPath } from './movement';

describe('collision', () => {
  it('lets the parent stand at the start and at every zone standing spot', () => {
    expect(isBlocked(START_POINT)).toBe(false);
    for (const id of ZONE_IDS) expect(isBlocked(ZONES[id].stand), id).toBe(false);
  });

  it('stops the parent at the walls and at furniture', () => {
    expect(isBlocked({ x: 99, z: 0 })).toBe(true);
    expect(isBlocked({ x: -2.2, z: 0.1 })).toBe(true); // the dining table
  });

  it('slides along a wall instead of sticking to it', () => {
    const nearWall = { x: 4.3, z: 0 };
    const moved = moveWithCollision(nearWall, { x: 1, z: 0.2 });
    expect(moved.x).toBe(nearWall.x);
    expect(moved.z).toBeCloseTo(0.2);
  });

  it('finds free floor next to a blocked spot', () => {
    expect(isBlocked(nearestFree({ x: -2.2, z: 0.1 }))).toBe(false);
  });
});

describe('directionFromKeys', () => {
  it('is zero with nothing pressed and unit length on a diagonal', () => {
    expect(directionFromKeys(new Set())).toEqual({ x: 0, z: 0 });
    const d = directionFromKeys(new Set(['w', 'd']));
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1);
    expect(d.z).toBeLessThan(0);
    expect(d.x).toBeGreaterThan(0);
  });

  it('cancels opposite keys', () => {
    expect(directionFromKeys(new Set(['a', 'd']))).toEqual({ x: 0, z: 0 });
  });
});

describe('routes', () => {
  it('gets from any room to any other room, around the furniture, without ever standing inside it', () => {
    for (const from of ZONE_IDS) {
      for (const to of ZONE_IDS) {
        let position = ZONES[from].stand;
        let route = planPath(position, ZONES[to].stand);
        for (let i = 0; i < 600 && route.length > 0; i += 1) {
          const step = followRoute(position, route, 0.1);
          expect(isBlocked(step.position), `${from} to ${to}`).toBe(false);
          position = step.position;
          route = step.route;
        }
        expect(route, `${from} to ${to} did not arrive`).toHaveLength(0);
        expect(distance(position, ZONES[to].stand)).toBeLessThan(0.06);
      }
    }
  });

  it('takes the straight line when nothing is in the way', () => {
    expect(planPath(ZONES.table.stand, ZONES.ledger.stand)).toHaveLength(1);
  });

  it('is never much longer than the straight-line distance', () => {
    for (const from of ZONE_IDS) {
      for (const to of ZONE_IDS) {
        const length = planPath(ZONES[from].stand, ZONES[to].stand).reduce(
          (sum, point, i, all) => sum + distance(i === 0 ? ZONES[from].stand : (all[i - 1] ?? point), point),
          0,
        );
        expect(length, `${from} to ${to}`).toBeLessThan(distance(ZONES[from].stand, ZONES[to].stand) * 2.2 + 0.1);
      }
    }
  });
});
