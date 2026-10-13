import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
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

  // Shell: floor and the two walls the camera looks at.
  box(group, [10.4, 0.3, 8.4], [0, -0.15, 0], { color: 0xc99a68, roughness: 0.9 });
  box(group, [10.4, 4.4, 0.3], [0, 2.2, -4.15], { color: WALL });
  box(group, [0.3, 4.4, 8.4], [-5.15, 2.2, 0], { color: 0xefdcc3 });
  box(group, [10.4, 0.22, 0.12], [0, 0.11, -3.94], { color: 0xffffff });
  box(group, [0.12, 0.22, 8.4], [-4.94, 0.11, 0], { color: 0xffffff });

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
  box(group, [2.4, 0.1, 1.1], [0.2, 0.82, -3.35], { color: WOOD });
  box(group, [0.1, 0.78, 1.0], [-0.95, 0.39, -3.35], { color: DARK_WOOD });
  box(group, [0.1, 0.78, 1.0], [1.35, 0.39, -3.35], { color: DARK_WOOD });
  box(group, [0.7, 0.04, 0.5], [0.0, 0.89, -3.1], { color: 0xf7f7f7 });
  box(group, [0.5, 0.06, 0.4], [0.9, 0.9, -3.3], { color: 0x4f6fd1 });
  cylinder(group, 0.08, 0.2, [-0.6, 0.97, -3.1], 0xe0b84a);
  cylinder(group, 0.1, 0.04, [1.1, 0.9, -3.65], 0x333333);
  box(group, [0.04, 0.5, 0.04], [1.1, 1.15, -3.65], { color: 0x333333 });
  box(group, [0.4, 0.1, 0.22], [1.0, 1.42, -3.62], { color: 0xf2c14e });

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
  box(group, [2.7, 0.95, 1.7], [3.3, 0.47, 1.35], { color: 0xf7f9fb });
  box(group, [2.4, 0.06, 1.4], [3.3, 0.93, 1.35], { color: 0x8fd0ee });
  cylinder(group, 0.05, 0.3, [4.4, 1.1, 0.7], 0xb8bcc4);
  const bubbles: Mesh[] = [];
  for (const [bx, bz, radius] of [
    [2.5, 1.5, 0.14],
    [2.8, 1.0, 0.1],
    [3.9, 1.7, 0.16],
    [3.6, 1.0, 0.09],
    [2.7, 1.8, 0.11],
    [4.1, 1.2, 0.12],
  ] as const) {
    const bubble = ball(group, radius, [bx, 1.0, bz], 0xffffff);
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

  // Door on the left wall with two school bags waiting beside it.
  box(group, [0.12, 3.0, 1.5], [-4.98, 1.5, 1.2], { color: 0x8a5a3c });
  box(group, [0.14, 2.7, 1.2], [-4.96, 1.4, 1.2], { color: 0x9c6847 });
  ball(group, 0.07, [-4.86, 1.45, 0.6], 0xe0b84a);
  for (const [bz, color] of [
    [2.5, 0xd1495b],
    [3.1, 0x4f9ad1],
  ] as const) {
    box(group, [0.4, 0.75, 0.55], [-4.5, 0.38, bz], { color });
    box(group, [0.14, 0.35, 0.4], [-4.28, 0.3, bz], { color: 0x2f2f3a });
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
