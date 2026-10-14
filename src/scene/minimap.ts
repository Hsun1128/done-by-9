import { FURNITURE, WALK_BOUNDS, WALLS, type Point } from '../engine/world';
import type { Marker } from './model';

/** What the map shows each frame. Positions are world points. */
export interface MinimapState {
  readonly parent: Point;
  readonly kids: readonly Point[];
  readonly markers: readonly { readonly at: Point; readonly kind: Marker['kind'] }[];
  readonly guide: Point | null;
  readonly pulse: number;
}

export interface Minimap {
  readonly element: HTMLCanvasElement;
  draw(state: MinimapState): void;
}

const WIDTH = 220;
const SPAN_X = WALK_BOUNDS.maxX - WALK_BOUNDS.minX;
const SPAN_Z = WALK_BOUNDS.maxZ - WALK_BOUNDS.minZ;
const HEIGHT = Math.round((WIDTH * SPAN_Z) / SPAN_X);
const SCALE = WIDTH / SPAN_X;

const MARKER_COLORS: Readonly<Record<Marker['kind'], string>> = {
  urgent: '#e5484d',
  event: '#f5a524',
  kid: '#3b82f6',
};

const toX = (x: number): number => (x - WALK_BOUNDS.minX) * SCALE;
const toY = (z: number): number => (z - WALK_BOUNDS.minZ) * SCALE;

/** A small top-down map of the whole world, so the player never loses the way home. */
export function createMinimap(): Minimap {
  const element = document.createElement('canvas');
  element.className = 'minimap';
  element.width = WIDTH * 2;
  element.height = HEIGHT * 2;
  element.setAttribute('aria-hidden', 'true');
  const ctx = element.getContext('2d');

  // The map never changes, so it is painted once onto its own canvas.
  const backdrop = document.createElement('canvas');
  backdrop.width = element.width;
  backdrop.height = element.height;
  const back = backdrop.getContext('2d');
  if (back !== null) {
    back.scale(2, 2);
    back.fillStyle = 'rgba(124, 178, 100, 0.75)';
    back.fillRect(0, 0, WIDTH, HEIGHT);
    // the street
    back.fillStyle = 'rgba(224, 218, 204, 0.9)';
    back.fillRect(toX(WALK_BOUNDS.minX), toY(-0.1), toX(-5.3) - toX(WALK_BOUNDS.minX), 2.6 * SCALE);
    // the flat's floor
    back.fillStyle = 'rgba(201, 154, 104, 0.95)';
    back.fillRect(toX(-5.0), toY(-3.7), 16.3 * SCALE, 7.4 * SCALE);
    back.fillRect(toX(-5.0), toY(3.7), 6.5 * SCALE, 2.6 * SCALE);
    back.fillStyle = 'rgba(70, 60, 55, 0.9)';
    for (const wall of WALLS) {
      back.fillRect(toX(wall.minX), toY(wall.minZ), (wall.maxX - wall.minX) * SCALE, (wall.maxZ - wall.minZ) * SCALE);
    }
    back.fillStyle = 'rgba(95, 80, 70, 0.9)';
    for (const item of FURNITURE) {
      back.fillRect(toX(item.minX), toY(item.minZ), (item.maxX - item.minX) * SCALE, (item.maxZ - item.minZ) * SCALE);
    }
  }

  return {
    element,
    draw(state) {
      if (ctx === null) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, element.width, element.height);
      ctx.drawImage(backdrop, 0, 0);
      ctx.scale(2, 2);
      for (const marker of state.markers) {
        ctx.fillStyle = MARKER_COLORS[marker.kind];
        ctx.beginPath();
        ctx.arc(toX(marker.at.x), toY(marker.at.z), 3.4 + state.pulse * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (state.guide !== null) {
        ctx.strokeStyle = '#ffd34d';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(toX(state.guide.x), toY(state.guide.z), 5.5 + state.pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const [index, kid] of state.kids.entries()) {
        ctx.fillStyle = index === 0 ? '#3f7fd6' : '#e86a92';
        ctx.beginPath();
        ctx.arc(toX(kid.x), toY(kid.z), 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1d1a1a';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(toX(state.parent.x), toY(state.parent.z), 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    },
  };
}
