import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { WALLS } from '../engine/world';
import { clockHands, type Sky } from './model';

interface Material {
  readonly color: number;
  readonly roughness?: number;
}

function box(
  parent: Group,
  size: readonly [number, number, number],
  position: readonly [number, number, number],
  material: Material,
): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(...size),
    new MeshStandardMaterial({ color: material.color, roughness: material.roughness ?? 0.85 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: Group,
  radius: number,
  height: number,
  position: readonly [number, number, number],
  color: number,
): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(radius, radius, height, 20),
    new MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ball(
  parent: Group,
  radius: number,
  position: readonly [number, number, number],
  color: number,
): Mesh {
  const mesh = new Mesh(
    new SphereGeometry(radius, 16, 12),
    new MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

const WALL = 0xf3e6d3;
const WOOD = 0xb5835a;
const DARK_WOOD = 0x7a5233;

/** Handles the stage animates each frame. */
export interface Room {
  readonly group: Group;
  readonly bubbles: readonly Mesh[];
  setSky(sky: Sky, clock: number): void;
  animate(t: number): void;
}

export function createRoom(): Room {
  const group = new Group();

  // Ground, then one floor per room. Outside is grass with a paved street.
  box(group, [66, 0.3, 36], [-17, -0.17, 0], { color: 0x9bc77a, roughness: 1 });
  box(group, [31.7, 0.04, 2.6], [-21.15, 0.0, 1.2], { color: 0xd9d3c7 }); // the street to school
  box(group, [2.6, 0.04, 4.6], [-13.4, 0.0, -1.0], { color: 0xd9d3c7 }); // the branch to the shops
  box(group, [2.6, 0.04, 4.6], [-20.9, 0.0, -1.0], { color: 0xd9d3c7 });
  box(group, [2.6, 0.04, 4.6], [-31.0, 0.0, -1.0], { color: 0xd9d3c7 });
  box(group, [2.6, 0.04, 3.6], [-22.0, 0.0, 3.6], { color: 0xd9d3c7 }); // the way into the park
  box(group, [4, 0.04, 2.4], [-7.4, 0.0, 1.2], { color: 0xcfc7b8 }); // the doorstep
  box(group, [9.7, 0.3, 7.4], [-0.15, -0.15, 0], { color: 0xc99a68, roughness: 0.9 }); // living room
  box(group, [6.0, 0.3, 3.7], [8.0, -0.15, -1.85], { color: 0x9fc3e8, roughness: 1 }); // kids' room
  box(group, [6.0, 0.3, 3.4], [8.0, -0.15, 2.0], { color: 0xdfe9ee, roughness: 0.5 }); // bathroom
  box(group, [6.5, 0.3, 2.6], [-1.75, -0.15, 5.0], { color: 0xb9b2a6, roughness: 1 }); // balcony

  // Walls. The north wall is tall and carries the window; all others are cut away so the camera sees in.
  box(group, [16.6, 4.4, 0.3], [3.0, 2.2, -3.85], { color: WALL });
  box(group, [16.6, 0.22, 0.12], [3.0, 0.11, -3.66], { color: 0xffffff });
  for (const wall of WALLS.slice(1)) {
    const w = wall.maxX - wall.minX;
    const d = wall.maxZ - wall.minZ;
    box(group, [w, 1.0, d], [(wall.minX + wall.maxX) / 2, 0.5, (wall.minZ + wall.maxZ) / 2], { color: 0xefdcc3 });
    box(group, [w + 0.04, 0.06, d + 0.04], [(wall.minX + wall.maxX) / 2, 1.01, (wall.minZ + wall.maxZ) / 2], {
      color: 0xffffff,
    });
  }

  // Window with a sky that changes through the evening.
  box(group, [2.7, 1.9, 0.1], [0.2, 2.6, -3.98], { color: 0xffffff });
  const skyTopMaterial = new MeshBasicMaterial({ color: 0x6f7fb8 });
  const skyBottomMaterial = new MeshBasicMaterial({ color: 0xf0b27a });
  const skyTop = new Mesh(new BoxGeometry(2.4, 0.8, 0.02), skyTopMaterial);
  skyTop.position.set(0.2, 3.0, -3.91);
  const skyBottom = new Mesh(new BoxGeometry(2.4, 0.8, 0.02), skyBottomMaterial);
  skyBottom.position.set(0.2, 2.2, -3.91);
  const moonMaterial = new MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0 });
  const moon = new Mesh(new SphereGeometry(0.2, 16, 12), moonMaterial);
  moon.position.set(0.95, 3.1, -3.88);
  const mullion = new Mesh(new BoxGeometry(0.06, 1.7, 0.05), new MeshStandardMaterial({ color: 0xffffff }));
  mullion.position.set(0.2, 2.6, -3.88);
  group.add(skyTop, skyBottom, moon, mullion);

  // Wall clock, driven by the game clock.
  cylinder(group, 0.62, 0.08, [-3.4, 3.55, -3.95], 0x3b2f2f).rotation.x = Math.PI / 2;
  cylinder(group, 0.55, 0.1, [-3.4, 3.55, -3.93], 0xffffff).rotation.x = Math.PI / 2;
  const hourHand = new Group();
  hourHand.position.set(-3.4, 3.55, -3.86);
  box(hourHand, [0.07, 0.3, 0.03], [0, 0.15, 0], { color: 0x222222 });
  const minuteHand = new Group();
  minuteHand.position.set(-3.4, 3.55, -3.83);
  box(minuteHand, [0.05, 0.46, 0.03], [0, 0.23, 0], { color: 0xb33a3a });
  group.add(hourHand, minuteHand);

  // Sofa (finished kids rest here) and a plant.
  box(group, [2.5, 0.5, 1.0], [-3.4, 0.25, -3.35], { color: 0x4e8f8a });
  box(group, [2.5, 0.9, 0.25], [-3.4, 0.7, -3.8], { color: 0x3f7c77 });
  box(group, [0.25, 0.8, 1.0], [-4.55, 0.4, -3.35], { color: 0x3f7c77 });
  box(group, [0.25, 0.8, 1.0], [-2.25, 0.4, -3.35], { color: 0x3f7c77 });
  cylinder(group, 0.25, 0.4, [-4.55, 0.2, -2.35], 0xc2623f);
  ball(group, 0.38, [-4.55, 0.7, -2.35], 0x4f9a52);
  ball(group, 0.26, [-4.4, 1.0, -2.3], 0x5fae62);

  // Dining table (dinner) with a plate in front of each kid.
  cylinder(group, 1.9, 0.02, [-2.2, 0.01, 0.2], 0xd9695f);
  box(group, [2.5, 0.12, 1.3], [-2.2, 0.86, 0.1], { color: WOOD });
  for (const [dx, dz] of [
    [-1.1, -0.5],
    [1.1, -0.5],
    [-1.1, 0.5],
    [1.1, 0.5],
  ] as const) {
    box(group, [0.12, 0.8, 0.12], [-2.2 + dx, 0.4, 0.1 + dz], { color: DARK_WOOD });
  }
  for (const dx of [-0.55, 0.55]) {
    cylinder(group, 0.26, 0.03, [-2.2 + dx, 0.94, -0.25], 0xffffff);
    box(group, [0.2, 0.08, 0.2], [-2.2 + dx, 0.99, -0.25], { color: 0xd95f4a });
    cylinder(group, 0.09, 0.2, [-2.2 + dx + 0.3, 1.0, 0.1], 0x9bd1e8);
  }
  box(group, [0.2, 0.16, 0.2], [-2.2, 0.98, 0.3], { color: 0x7fbf6a });

  // Homework desk with a lamp, notebook and pencil cup.
  const deskGroup = new Group();
  deskGroup.position.set(8.1, 0, 0);
  group.add(deskGroup);
  box(deskGroup, [2.4, 0.1, 1.1], [0.2, 0.82, -3.35], { color: WOOD });
  box(deskGroup, [0.1, 0.78, 1.0], [-0.95, 0.39, -3.35], { color: DARK_WOOD });
  box(deskGroup, [0.1, 0.78, 1.0], [1.35, 0.39, -3.35], { color: DARK_WOOD });
  box(deskGroup, [0.7, 0.04, 0.5], [0.0, 0.89, -3.1], { color: 0xf7f7f7 });
  box(deskGroup, [0.5, 0.06, 0.4], [0.9, 0.9, -3.3], { color: 0x4f6fd1 });
  cylinder(deskGroup, 0.08, 0.2, [-0.6, 0.97, -3.1], 0xe0b84a);
  cylinder(deskGroup, 0.1, 0.04, [1.1, 0.9, -3.65], 0x333333);
  box(deskGroup, [0.04, 0.5, 0.04], [1.1, 1.15, -3.65], { color: 0x333333 });
  box(deskGroup, [0.4, 0.1, 0.22], [1.0, 1.42, -3.62], { color: 0xf2c14e });

  // Kitchen counter and sink (dishes).
  box(group, [2.9, 0.9, 1.1], [3.2, 0.45, -3.35], { color: 0xe9e4dc });
  box(group, [3.0, 0.06, 1.2], [3.2, 0.93, -3.35], { color: 0x8c8f99 });
  box(group, [1.0, 0.04, 0.6], [3.2, 0.96, -3.3], { color: 0x4a5565 });
  cylinder(group, 0.04, 0.4, [3.2, 1.15, -3.7], 0xb8bcc4);
  box(group, [0.04, 0.04, 0.3], [3.2, 1.34, -3.58], { color: 0xb8bcc4 });
  for (let i = 0; i < 3; i += 1) {
    cylinder(group, 0.24, 0.04, [2.1, 0.99 + i * 0.05, -3.3], 0xffffff);
  }

  // Bathtub (bath) with bubbles floating on the water.
  const tubGroup = new Group();
  tubGroup.position.set(6.1, 0, 1.4);
  group.add(tubGroup);
  box(tubGroup, [2.7, 0.95, 1.7], [3.3, 0.47, 1.35], { color: 0xf7f9fb });
  box(tubGroup, [2.4, 0.06, 1.4], [3.3, 0.93, 1.35], { color: 0x8fd0ee });
  cylinder(tubGroup, 0.05, 0.3, [4.4, 1.1, 0.7], 0xb8bcc4);
  const bubbles: Mesh[] = [];
  for (const [bx, bz, radius] of [
    [2.5, 1.5, 0.14],
    [2.8, 1.0, 0.1],
    [3.9, 1.7, 0.16],
    [3.6, 1.0, 0.09],
    [2.7, 1.8, 0.11],
    [4.1, 1.2, 0.12],
  ] as const) {
    const bubble = ball(tubGroup, radius, [bx, 1.0, bz], 0xffffff);
    bubbles.push(bubble);
  }

  // Family-budget table: phone, a stack of bills and a piggy bank.
  box(group, [1.6, 0.08, 0.8], [-1.2, 0.72, 3.0], { color: WOOD });
  for (const [dx, dz] of [
    [-0.7, -0.3],
    [0.7, -0.3],
    [-0.7, 0.3],
    [0.7, 0.3],
  ] as const) {
    box(group, [0.08, 0.7, 0.08], [-1.2 + dx, 0.35, 3.0 + dz], { color: DARK_WOOD });
  }
  box(group, [0.22, 0.03, 0.4], [-1.65, 0.78, 2.95], { color: 0x2f3138 });
  box(group, [0.2, 0.01, 0.36], [-1.65, 0.8, 2.95], { color: 0x8fd0ee });
  for (let i = 0; i < 4; i += 1) {
    box(group, [0.38, 0.015, 0.28], [-1.05 + i * 0.01, 0.77 + i * 0.016, 3.0], { color: i % 2 === 0 ? 0xffffff : 0xfff1b8 });
  }
  ball(group, 0.2, [-0.6, 0.98, 3.0], 0xf2a1b5);
  box(group, [0.06, 0.06, 0.06], [-0.6, 1.2, 3.0], { color: 0xf2a1b5 });
  box(group, [0.12, 0.02, 0.02], [-0.6, 1.17, 3.0], { color: 0x333333 });

  // Front door: an open doorway with a frame and mat, and two school bags waiting beside it.
  box(group, [0.2, 2.8, 0.14], [-5.15, 1.4, 0.4], { color: 0x8a5a3c });
  box(group, [0.2, 2.8, 0.14], [-5.15, 1.4, 2.0], { color: 0x8a5a3c });
  box(group, [0.2, 0.16, 1.74], [-5.15, 2.8, 1.2], { color: 0x8a5a3c });
  box(group, [1.0, 0.04, 1.2], [-4.5, 0.02, 1.2], { color: 0x7a4a3a });
  for (const [bz, color] of [
    [2.5, 0xd1495b],
    [3.1, 0x4f9ad1],
  ] as const) {
    box(group, [0.4, 0.75, 0.55], [-4.5, 0.38, bz], { color });
    box(group, [0.14, 0.35, 0.4], [-4.28, 0.3, bz], { color: 0x2f2f3a });
  }

  // Kids' room: bed against the east wall, bookshelf, rug with toys.
  box(group, [1.25, 0.45, 2.7], [10.32, 0.22, -2.15], { color: 0xd8c3a5 });
  box(group, [1.25, 0.2, 2.5], [10.32, 0.55, -2.05], { color: 0xf2a1b5 });
  box(group, [1.0, 0.18, 0.6], [10.32, 0.72, -3.1], { color: 0xffffff });
  box(group, [0.9, 1.6, 0.4], [5.95, 0.8, -3.2], { color: DARK_WOOD });
  for (const [dy, color] of [
    [0.35, 0xd1495b],
    [0.85, 0x4f9ad1],
    [1.35, 0xe0b84a],
  ] as const) {
    box(group, [0.8, 0.22, 0.3], [5.95, dy, -3.15], { color });
  }
  cylinder(group, 1.3, 0.02, [6.9, 0.01, -1.2], 0xf0c75e);
  box(group, [0.35, 0.35, 0.35], [6.5, 0.18, -1.6], { color: 0xd1495b });
  box(group, [0.35, 0.35, 0.35], [6.85, 0.18, -1.6], { color: 0x4f9ad1 });
  box(group, [0.35, 0.35, 0.35], [6.67, 0.53, -1.6], { color: 0x7fbf6a });
  ball(group, 0.22, [7.5, 0.22, -1.7], 0xf2a1b5);
  box(group, [0.6, 0.12, 0.3], [6.2, 0.08, -0.4], { color: 0x4f9ad1 });

  // Bathroom: toilet by the wall, a small basin, a mat.
  box(group, [0.7, 0.45, 0.9], [5.85, 0.22, 0.95], { color: 0xffffff });
  box(group, [0.7, 0.9, 0.3], [5.6, 0.7, 0.95], { color: 0xf4f6f8 });
  box(group, [0.8, 0.9, 0.5], [6.3, 0.45, 3.4], { color: 0xe9e4dc });
  box(group, [0.55, 0.06, 0.4], [6.3, 0.93, 3.4], { color: 0x8fd0ee });
  box(group, [1.0, 0.03, 0.6], [7.0, 0.02, 2.75], { color: 0xf2a1b5 });

  // Balcony: washing machine, a clothesline and plants.
  box(group, [1.2, 1.0, 1.1], [-3.95, 0.5, 5.05], { color: 0xf4f6f8 });
  cylinder(group, 0.38, 0.06, [-3.95, 0.55, 4.48], 0x8fd0ee).rotation.x = Math.PI / 2;
  box(group, [0.06, 2.0, 0.06], [-4.6, 1.0, 5.95], { color: 0x8c8f99 });
  box(group, [0.06, 2.0, 0.06], [0.9, 1.0, 5.95], { color: 0x8c8f99 });
  box(group, [5.5, 0.04, 0.04], [-1.85, 1.95, 5.95], { color: 0x8c8f99 });
  for (const [dx, color] of [
    [-3.4, 0xf2a1b5],
    [-2.5, 0x8fd0ee],
    [-1.4, 0xf0c75e],
    [-0.4, 0xffffff],
  ] as const) {
    box(group, [0.6, 0.8, 0.05], [dx, 1.5, 5.95], { color });
  }
  cylinder(group, 0.22, 0.4, [1.1, 0.2, 6.0], 0xc2623f);
  ball(group, 0.36, [1.1, 0.7, 6.0], 0x4f9a52);

  // Outside: shops and the school, each with a painted sign, then the park.
  const sign = (text: string, color: string, at: readonly [number, number, number], width: number): void => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx !== null) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 84px system-ui, "PingFang TC", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 68);
    }
    const mesh = new Mesh(new PlaneGeometry(width, width / 4), new MeshBasicMaterial({ map: new CanvasTexture(canvas) }));
    mesh.position.set(...at);
    mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
  };
  box(group, [4.4, 3.4, 6.8], [-16.8, 1.7, -4.6], { color: 0xf1c27a });
  box(group, [0.9, 0.15, 6.8], [-14.3, 2.5, -4.6], { color: 0xd1495b });
  box(group, [0.1, 2.0, 1.6], [-14.62, 1.0, -2.4], { color: 0x9bd1e8 });
  sign('超市', '#d1495b', [-14.55, 2.95, -4.6], 3.6);
  box(group, [4.4, 3.2, 6.8], [-24.4, 1.6, -4.6], { color: 0xcfe8d5 });
  box(group, [0.9, 0.15, 6.8], [-21.9, 2.4, -4.6], { color: 0x3f9d6a });
  box(group, [0.1, 2.0, 1.6], [-22.22, 1.0, -2.4], { color: 0x9bd1e8 });
  sign('藥局', '#3f9d6a', [-22.15, 2.8, -4.6], 3.2);
  box(group, [4.6, 4.6, 7.8], [-34.7, 2.3, -5.1], { color: 0xe9d6a0 });
  box(group, [5.0, 0.3, 8.2], [-34.7, 4.75, -5.1], { color: 0xb5835a });
  sign('小學', '#3b82c4', [-32.35, 3.8, -5.1], 4.4);
  box(group, [0.1, 2.0, 1.4], [-32.42, 1.0, -2.4], { color: 0x6e8aa8 });
  box(group, [0.3, 1.6, 0.3], [-31.6, 0.8, -1.5], { color: 0xb8bcc4 });
  box(group, [0.3, 1.6, 0.3], [-31.6, 0.8, -3.3], { color: 0xb8bcc4 });
  box(group, [0.1, 4.2, 0.1], [-30.4, 2.1, -6.2], { color: 0xb8bcc4 });
  box(group, [0.04, 0.5, 0.8], [-30.4, 3.9, -5.8], { color: 0xd1495b });

  // The park lies south of the street: flat lawn, a bench, trees and a flower bed.
  box(group, [10.0, 0.03, 6.8], [-22.0, 0.0, 7.0], { color: 0x7fb366, roughness: 1 });
  box(group, [0.5, 0.45, 1.4], [-26.2, 0.23, 5.2], { color: WOOD });
  box(group, [0.1, 0.5, 1.4], [-26.45, 0.65, 5.2], { color: WOOD });
  for (const [tx, tz, tall] of [
    [-25.0, 6.6, 2.3],
    [-19.5, 8.2, 2.6],
    [-22.8, 9.0, 2.0],
  ] as const) {
    cylinder(group, 0.16, tall * 0.5, [tx, tall * 0.25, tz], DARK_WOOD);
    const crown = new Mesh(new ConeGeometry(0.95, tall * 0.9, 12), new MeshStandardMaterial({ color: 0x4f9a52, roughness: 0.9 }));
    crown.position.set(tx, tall * 0.8, tz);
    crown.castShadow = true;
    group.add(crown);
  }
  box(group, [1.3, 1.1, 0.1], [-22.0, 0.55, 3.8], { color: 0xf2f0e6 }); // park sign
  box(group, [1.2, 0.35, 0.6], [-19.8, 0.18, 5.0], { color: 0xf2a1b5 }); // flower bed
  ball(group, 0.3, [-19.8, 0.5, 5.0], 0xd1495b);
  // Street lamps along the road.
  for (const lx of [-9, -17, -25]) {
    box(group, [0.1, 3.0, 0.1], [lx, 1.5, 2.9], { color: 0x4a5565 });
    ball(group, 0.22, [lx, 3.1, 2.9], 0xfff1b8);
  }

  return {
    group,
    bubbles,
    setSky(sky, clock) {
      skyTopMaterial.color.setHex(sky.top);
      skyBottomMaterial.color.setHex(sky.bottom);
      moonMaterial.opacity = Math.min(1, Math.max(0, (0.5 - sky.daylight) * 3));
      const hands = clockHands(clock);
      hourHand.rotation.z = -hands.hour;
      minuteHand.rotation.z = -hands.minute;
    },
    animate(t) {
      bubbles.forEach((bubble, index) => {
        bubble.position.y = 1.0 + Math.sin(t * 1.6 + index * 1.7) * 0.04;
      });
    },
  };
}
