import { describe, expect, it } from 'vitest';
import { ZONE_IDS } from './types';
import {
  INTERACT_RADIUS,
  OBSTACLES,
  START_POINT,
  WALK_BOUNDS,
  ZONES,
  distance,
  kidPoint,
  nearestZone,
  travelUnits,
} from './world';

describe('the home', () => {
  it('has a standing spot for every zone, inside the walkable bounds and outside the furniture', () => {
    for (const id of ZONE_IDS) {
      const { x, z } = ZONES[id].stand;
      expect(x, `${id} x`).toBeGreaterThan(WALK_BOUNDS.minX);
      expect(x, `${id} x`).toBeLessThan(WALK_BOUNDS.maxX);
      expect(z, `${id} z`).toBeGreaterThan(WALK_BOUNDS.minZ);
      expect(z, `${id} z`).toBeLessThan(WALK_BOUNDS.maxZ);
      for (const box of OBSTACLES) {
        const inside = x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ;
        expect(inside, `${id} stand spot is inside a piece of furniture`).toBe(false);
      }
    }
  });

  it('starts the parent outside every interaction range, so nothing is available by accident', () => {
    expect(nearestZone(START_POINT)).toBeNull();
  });

  it('keeps zones far enough apart that one standing spot never reaches two rooms', () => {
    for (const a of ZONE_IDS) {
      for (const b of ZONE_IDS) {
        if (a === b) continue;
        expect(distance(ZONES[a].stand, ZONES[b].stand), `${a} vs ${b}`).toBeGreaterThan(
          INTERACT_RADIUS,
        );
      }
    }
  });
});

describe('nearestZone', () => {
  it('finds a zone from its own standing spot and from just inside its range', () => {
    for (const id of ZONE_IDS) {
      const { x, z } = ZONES[id].stand;
      expect(nearestZone({ x, z })).toBe(id);
      expect(nearestZone({ x: x + INTERACT_RADIUS * 0.9, z })).toBe(id);
    }
  });

  it('finds nothing just outside range', () => {
    const { x, z } = ZONES.table.stand;
    expect(nearestZone({ x: x + INTERACT_RADIUS + 0.2, z })).toBeNull();
  });
});

describe('travelUnits', () => {
  it('is symmetric between rooms and zero to the same room', () => {
    for (const a of ZONE_IDS) {
      expect(travelUnits(a, a)).toBe(0);
      for (const b of ZONE_IDS) {
        expect(travelUnits(a, b)).toBeCloseTo(travelUnits(b, a));
      }
    }
  });

  it('measures the first walk from the starting point', () => {
    expect(travelUnits(null, 'table')).toBeCloseTo(distance(START_POINT, ZONES.table.stand));
  });
});

describe('kidPoint', () => {
  it('puts two kids side by side in a shared room and nobody in the family-budget room', () => {
    const elder = kidPoint('table', 'elder');
    const younger = kidPoint('table', 'younger');
    expect(elder).not.toBeNull();
    expect(younger).not.toBeNull();
    expect(elder?.x).toBeLessThan(younger?.x ?? Number.NEGATIVE_INFINITY);
    expect(kidPoint('ledger', 'elder')).toBeNull();
  });
});
