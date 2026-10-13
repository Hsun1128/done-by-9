import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { Pose } from './model';

/**
 * A block-built character. Joints are pivot groups so poses are just a handful
 * of angles; `applyJoints` smooths towards a target so poses blend instead of pop.
 */

export interface Look {
  readonly shirt: number;
  readonly pants: number;
  readonly skin: number;
  readonly hair: number;
  readonly scale: number;
}

/** Everything a pose can move. Angles are radians; `lift` is metres; `smile` and `brow` are -1..1. */
export interface Joints {
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  headX: number;
  headZ: number;
  legLx: number;
  legRx: number;
  lift: number;
  lean: number;
  smile: number;
  brow: number;
}

export interface Rig {
  readonly root: Group;
  readonly body: Group;
  readonly joints: Joints;
  readonly parts: {
    readonly armL: Group;
    readonly armR: Group;
    readonly head: Group;
    readonly legL: Group;
    readonly legR: Group;
    readonly mouth: Mesh;
    readonly browL: Mesh;
    readonly browR: Mesh;
  };
}

const RELAXED: Joints = {
  armLx: 0,
  armLz: -0.08,
  armRx: 0,
  armRz: 0.08,
  headX: 0,
  headZ: 0,
  legLx: 0,
  legRx: 0,
  lift: 0,
  lean: 0,
  smile: 0.3,
  brow: 0,
};

export function relaxedJoints(): Joints {
  return { ...RELAXED };
}

function block(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): Mesh {
  const mesh = new Mesh(
    new BoxGeometry(w, h, d),
    new MeshStandardMaterial({ color, roughness: 0.8, metalness: 0 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A pivot group at (x, y, z) holding a block that hangs `length` below the pivot. */
function limb(width: number, length: number, color: number, x: number, y: number): Group {
  const pivot = new Group();
  pivot.position.set(x, y, 0);
  pivot.add(block(width, length, width, color, 0, -length / 2, 0));
  return pivot;
}

export function createCharacter(look: Look): Rig {
  const root = new Group();
  const body = new Group();
  root.add(body);

  const hipY = 0.5;
  const legL = limb(0.22, hipY, look.pants, -0.15, hipY);
  const legR = limb(0.22, hipY, look.pants, 0.15, hipY);
  const torso = block(0.62, 0.6, 0.36, look.shirt, 0, hipY + 0.3, 0);
  const armL = limb(0.18, 0.55, look.shirt, -0.4, hipY + 0.55);
  const armR = limb(0.18, 0.55, look.shirt, 0.4, hipY + 0.55);
  // Hands are skin-coloured tips so arm motion reads at a distance.
  armL.add(block(0.17, 0.14, 0.17, look.skin, 0, -0.55, 0));
  armR.add(block(0.17, 0.14, 0.17, look.skin, 0, -0.55, 0));

  const head = new Group();
  head.position.set(0, hipY + 0.62, 0);
  head.add(block(0.52, 0.52, 0.5, look.skin, 0, 0.26, 0));
  head.add(block(0.56, 0.18, 0.54, look.hair, 0, 0.55, -0.01));
  head.add(block(0.56, 0.34, 0.1, look.hair, 0, 0.32, -0.22));
  head.add(block(0.07, 0.1, 0.03, 0x1b1b2a, -0.13, 0.3, 0.255));
  head.add(block(0.07, 0.1, 0.03, 0x1b1b2a, 0.13, 0.3, 0.255));
  const browL = block(0.13, 0.03, 0.03, look.hair, -0.13, 0.42, 0.255);
  const browR = block(0.13, 0.03, 0.03, look.hair, 0.13, 0.42, 0.255);
  const mouth = block(0.14, 0.04, 0.03, 0x8a3b3b, 0, 0.13, 0.255);
  head.add(browL, browR, mouth);

  body.add(legL, legR, torso, armL, armR, head);
  root.scale.setScalar(look.scale);

  return {
    root,
    body,
    joints: relaxedJoints(),
    parts: { armL, armR, head, legL, legR, mouth, browL, browR },
  };
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Joint targets for a pose at time `t` seconds. `mood` (0-100) colours the resting face. */
export function targetJoints(pose: Pose, t: number, moving: boolean, mood: number): Joints {
  const j = relaxedJoints();
  j.smile = clamp((mood - 50) / 40, -1, 1);
  j.brow = j.smile < 0 ? -j.smile * 0.6 : 0;

  if (moving) {
    const swing = Math.sin(t * 11) * 0.75;
    j.legLx = swing;
    j.legRx = -swing;
    j.armLx = -swing * 0.6;
    j.armRx = swing * 0.6;
    j.lift = Math.abs(Math.sin(t * 11)) * 0.06;
    return j;
  }

  switch (pose) {
    case 'idle':
      j.lift = Math.sin(t * 2) * 0.012;
      j.armLz = -0.1 + Math.sin(t * 1.6) * 0.04;
      j.armRz = 0.1 - Math.sin(t * 1.6) * 0.04;
      break;
    case 'eat':
      j.armRx = -1.25 + Math.sin(t * 3.2) * 0.55;
      j.armLx = -0.35;
      j.headX = 0.08 + Math.sin(t * 3.2) * 0.1;
      break;
    case 'write':
      j.headX = 0.5;
      j.lean = 0.14;
      j.armRx = -1.05 + Math.sin(t * 9) * 0.07;
      j.armLx = -0.85;
      break;
    case 'wash':
      j.headX = 0.3;
      j.armLx = -0.95 + Math.sin(t * 7) * 0.28;
      j.armRx = -0.95 - Math.sin(t * 7) * 0.28;
      break;
    case 'bathe':
      j.lift = -0.1 + Math.sin(t * 2.4) * 0.03;
      j.armRz = 1.35 + Math.sin(t * 5) * 0.35;
      j.armLz = -1.35 - Math.sin(t * 5 + 1.2) * 0.35;
      j.smile = Math.max(j.smile, 0.5);
      break;
    case 'pack':
      j.lean = 0.22;
      j.headX = 0.25;
      j.armLx = -0.9 + Math.sin(t * 6) * 0.45;
      j.armRx = -0.9 - Math.sin(t * 6) * 0.45;
      break;
    case 'sulk':
      j.headX = 0.6;
      j.headZ = Math.sin(t * 1.4) * 0.06;
      j.lean = 0.2;
      j.armLz = -0.03;
      j.armRz = 0.03;
      j.smile = -1;
      j.brow = 0.9;
      break;
    case 'cheer': {
      const hop = Math.abs(Math.sin(t * 6));
      j.lift = hop * 0.32;
      j.armRz = 2.5 + Math.sin(t * 12) * 0.25;
      j.armLz = -2.5 - Math.sin(t * 12) * 0.25;
      j.legLx = -hop * 0.3;
      j.legRx = hop * 0.3;
      j.smile = 1;
      j.brow = 0;
      break;
    }
    case 'rest':
      j.lift = -0.32;
      j.legLx = -1.5;
      j.legRx = -1.5;
      j.armLz = -0.15;
      j.armRz = 0.15;
      j.headX = -0.05;
      j.smile = Math.max(j.smile, 0.6);
      break;
  }
  return j;
}

/** Moves `joints` a fraction `k` (0..1) of the way to `target`. */
export function blendJoints(joints: Joints, target: Joints, k: number): void {
  for (const key of Object.keys(joints) as (keyof Joints)[]) {
    joints[key] += (target[key] - joints[key]) * k;
  }
}

/** Writes joint values onto the rig's pivot groups and face blocks. */
export function applyJoints(rig: Rig): void {
  const { joints: j, parts: p } = rig;
  p.armL.rotation.set(j.armLx, 0, j.armLz);
  p.armR.rotation.set(j.armRx, 0, j.armRz);
  p.legL.rotation.x = j.legLx;
  p.legR.rotation.x = j.legRx;
  p.head.rotation.set(j.headX, 0, j.headZ);
  rig.body.position.y = j.lift;
  rig.body.rotation.x = j.lean;
  // Smile: a wider, taller mouth. Frown: narrow, thin and lower.
  p.mouth.scale.set(
    1 + Math.max(0, j.smile) * 0.7 - Math.max(0, -j.smile) * 0.3,
    Math.max(0.35, 1 + j.smile * 1.6),
    1,
  );
  p.mouth.position.y = 0.13 - Math.max(0, -j.smile) * 0.02;
  // Sad brows tilt with their inner ends raised.
  p.browL.rotation.z = j.brow * 0.45;
  p.browR.rotation.z = -j.brow * 0.45;
}
