import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  Raycaster,
  RingGeometry,
  Scene,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  applyJoints,
  blendJoints,
  createCharacter,
  targetJoints,
  type Look,
  type Rig,
} from './character';
import { KID_IDS, ZONE_IDS, type KidId, type ZoneId } from '../engine/types';
import { START_POINT, WALK_BOUNDS, ZONES, kidPoint, nearestZone, type Point } from '../engine/world';
import { skyAt, type Marker, type SceneView } from './model';
import { createRoom } from './room';
import {
  PLAYER_RADIUS,
  directionFromKeys,
  followRoute,
  moveWithCollision,
  nearestFree,
  planPath,
} from './movement';

/** What the stage tells the game. The stage owns the parent's position; the game owns time. */
export interface StageEvents {
  /** The parent walked `units` room units since the last call. Calls are batched. */
  onWalk(units: number): void;
  /** The zone the parent is now close enough to use, or null. Called only when it changes. */
  onNear(zone: ZoneId | null): void;
}

/** The 3D view of the day. One instance lives for the whole page. */
export interface Stage {
  /** Host element. Safe to move between screens: the WebGL context moves with it. */
  readonly element: HTMLElement;
  /** Describe what the room should look like now. Cheap; call on every game change. */
  update(view: SceneView): void;
  /** Analog stick input, each axis -1..1 (x right, z towards the camera). Cancels an auto-walk. */
  setStick(x: number, z: number): void;
  /** Walk to a room's standing spot, around the furniture. */
  walkTo(zone: ZoneId): void;
  /** While frozen the parent stands still and ignores input (a conversation, the end screen). */
  setFrozen(frozen: boolean): void;
  /** Put the parent back at the start of a new day. */
  reset(): void;
  start(): void;
  stop(): void;
}

/** Thrown when the browser cannot create a WebGL context. There is no 2D fallback by design. */
export class StageUnavailableError extends Error {
  override name = 'StageUnavailableError';
}

const LOOKS: Readonly<Record<KidId | 'parent', Look>> = {
  elder: { shirt: 0x3f7fd6, pants: 0x35415e, skin: 0xf2c9a0, hair: 0x2b2118, scale: 0.92 },
  younger: { shirt: 0xe86a92, pants: 0x7c5aa6, skin: 0xf6d2ae, hair: 0x5a3320, scale: 0.78 },
  parent: { shirt: 0x6a8f5c, pants: 0x3c4150, skin: 0xe7b98f, hair: 0x1d1a1a, scale: 1.2 },
};

/** Walking speed in room units per second. */
const WALK_SPEED = 4.2;
/** Camera framing for a 4:3 stage; narrower stages pull back to keep the room in view. */
const CAMERA_HOME = new Vector3(2.4, 8.2, 11.2);
const CAMERA_TARGET = new Vector3(-0.2, 0.9, -0.4);
const REFERENCE_ASPECT = 1.3;

interface Actor {
  readonly rig: Rig;
  readonly goal: Vector3;
  goalYaw: number;
  pose: Parameters<typeof targetJoints>[0];
  mood: number;
  moving: boolean;
}

function newActor(look: Look, start: Vector3): Actor {
  const rig = createCharacter(look);
  rig.root.position.copy(start);
  return { rig, goal: start.clone(), goalYaw: 0, pose: 'idle', mood: 60, moving: false };
}

/** Shortest signed difference between two angles. */
function angleDelta(from: number, to: number): number {
  return MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
}

function step(actor: Actor, t: number, dt: number, reducedMotion: boolean): void {
  const { root } = actor.rig;
  const dx = actor.goal.x - root.position.x;
  const dz = actor.goal.z - root.position.z;
  const distance = Math.hypot(dx, dz);

  if (reducedMotion) {
    root.position.copy(actor.goal);
    root.rotation.y = actor.goalYaw;
    actor.moving = false;
  } else if (distance > 0.04) {
    const travel = Math.min(distance, WALK_SPEED * dt);
    root.position.x += (dx / distance) * travel;
    root.position.z += (dz / distance) * travel;
    const heading = Math.atan2(dx, dz);
    root.rotation.y += angleDelta(root.rotation.y, heading) * Math.min(1, dt * 12);
    actor.moving = true;
  } else {
    root.position.x = actor.goal.x;
    root.position.z = actor.goal.z;
    root.rotation.y += angleDelta(root.rotation.y, actor.goalYaw) * Math.min(1, dt * 10);
    actor.moving = false;
  }
  root.position.y += (actor.goal.y - root.position.y) * Math.min(1, dt * 10);

  const target = targetJoints(actor.pose, reducedMotion ? 0 : t, actor.moving, actor.mood);
  blendJoints(actor.rig.joints, target, reducedMotion ? 1 : 1 - Math.exp(-dt * 12));
  applyJoints(actor.rig);
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size = 128): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const MARKER_COLORS: Readonly<Record<Marker['kind'], string>> = {
  urgent: '#e5484d',
  event: '#f5a524',
  kid: '#3b82f6',
};

function markerTexture(kind: Marker['kind']): CanvasTexture {
  return canvasTexture((ctx, size) => {
    ctx.fillStyle = MARKER_COLORS[kind];
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.7}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', size / 2, size / 2 + size * 0.04);
  });
}

/** A small name tag as a sprite, drawn on a canvas so Traditional Chinese needs no font files. */
function tagSprite(text: string, color: string): Sprite {
  const width = 256;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx !== null) {
    ctx.fillStyle = 'rgba(30, 24, 20, 0.78)';
    ctx.beginPath();
    ctx.roundRect(8, 16, width - 16, height - 32, 24);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 44px system-ui, "PingFang TC", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2 + 2);
  }
  const texture = new CanvasTexture(canvas);
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.05, 0.39, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Room name painted flat on the floor, so the player learns where things are. */
function floorLabel(text: string): Mesh {
  const texture = canvasTexture((ctx, size) => {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(60, 40, 25, 0.55)';
    ctx.font = 'bold 40px system-ui, "PingFang TC", "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
  }, 256);
  const mesh = new Mesh(
    new PlaneGeometry(1.2, 1.2),
    new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** Where a "!" floats for a room: over the kids when there are any, over the standing spot otherwise. */
function markerAnchor(zone: ZoneId): Vector3 {
  const spec = ZONES[zone];
  if (spec.kid === null) return new Vector3(spec.stand.x - 0.2, 2.0, spec.stand.z + 0.9);
  return new Vector3(spec.kid.x, spec.kid.y + 2.6, spec.kid.z);
}

/** Real seconds of walking before a batch of distance is reported to the game. */
const REPORT_UNITS = 0.7;

export function createStage(events: StageEvents): Stage {
  const element = document.createElement('div');
  element.className = 'stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'stage__canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '家裡的 3D 場景：兩個孩子和你');
  element.append(canvas);

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (error) {
    throw new StageUnavailableError(
      error instanceof Error ? error.message : 'WebGL is not available in this browser',
    );
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const room = createRoom();
  scene.add(room.group);

  const ambient = new AmbientLight(0xffffff, 0.55);
  const sun = new DirectionalLight(0xfff0dc, 1.2);
  sun.position.set(-5, 10, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -8;
  sun.shadow.camera.right = 8;
  sun.shadow.camera.top = 8;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 30;
  const lamp = new PointLight(0xffc27a, 20, 0, 1.6);
  lamp.position.set(0, 3.9, 0.5);
  scene.add(ambient, sun, lamp);

  const camera = new PerspectiveCamera(38, REFERENCE_ASPECT, 0.1, 60);

  const actors: Readonly<Record<KidId | 'parent', Actor>> = {
    elder: newActor(LOOKS.elder, new Vector3(-0.5, 0, 3)),
    younger: newActor(LOOKS.younger, new Vector3(0.5, 0, 3)),
    parent: newActor(LOOKS.parent, new Vector3(START_POINT.x, 0, START_POINT.z)),
  };
  for (const actor of Object.values(actors)) scene.add(actor.rig.root);

  // Name tags follow the characters.
  const tags: Readonly<Record<KidId | 'parent', Sprite>> = {
    elder: tagSprite('小禾', '#9cc4ff'),
    younger: tagSprite('小米', '#ffb3cd'),
    parent: tagSprite('你', '#b9e6a3'),
  };
  for (const tag of Object.values(tags)) scene.add(tag);

  // Floor labels, "!" markers and the guide ring.
  for (const zone of ZONE_IDS) {
    const mesh = floorLabel(ZONES[zone].label);
    mesh.position.set(ZONES[zone].stand.x, 0.02, ZONES[zone].stand.z + 0.55);
    scene.add(mesh);
  }

  const markerTextures = {
    urgent: markerTexture('urgent'),
    event: markerTexture('event'),
    kid: markerTexture('kid'),
  } as const;
  const markerSprites = new Map<ZoneId, Sprite>();
  for (const zone of ZONE_IDS) {
    const sprite = new Sprite(new SpriteMaterial({ map: markerTextures.event, transparent: true, depthTest: false }));
    sprite.scale.set(0.62, 0.62, 1);
    sprite.renderOrder = 11;
    sprite.visible = false;
    sprite.position.copy(markerAnchor(zone));
    scene.add(sprite);
    markerSprites.set(zone, sprite);
  }
  const ring = new Mesh(
    new RingGeometry(0.62, 0.78, 40),
    new MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9, side: DoubleSide, depthTest: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 9;
  ring.visible = false;
  scene.add(ring);

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // --- The parent: position, input, route -------------------------------------
  let position: Point = START_POINT;
  let route: readonly Point[] = [];
  let stick: Point = { x: 0, z: 0 };
  let frozen = false;
  let near: ZoneId | null = null;
  let unreported = 0;
  let facing: Point | null = null;
  let guide: ZoneId | null = null;
  const keys = new Set<string>();

  const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

  function onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (!MOVE_KEYS.has(key)) return;
    event.preventDefault();
    keys.add(key);
  }
  function onKeyUp(event: KeyboardEvent): void {
    keys.delete(event.key.toLowerCase());
  }
  function onBlur(): void {
    keys.clear();
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const raycaster = new Raycaster();
  const floor = new Plane(new Vector3(0, 1, 0), 0);
  function onPointerDown(event: PointerEvent): void {
    if (frozen) return;
    const bounds = canvas.getBoundingClientRect();
    const pointer = new Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = new Vector3();
    if (raycaster.ray.intersectPlane(floor, hit) === null) return;
    const clamped: Point = {
      x: MathUtils.clamp(hit.x, WALK_BOUNDS.minX + PLAYER_RADIUS, WALK_BOUNDS.maxX - PLAYER_RADIUS),
      z: MathUtils.clamp(hit.z, WALK_BOUNDS.minZ + PLAYER_RADIUS, WALK_BOUNDS.maxZ - PLAYER_RADIUS),
    };
    route = planPath(position, nearestFree(clamped));
  }
  canvas.addEventListener('pointerdown', onPointerDown);

  function flush(): void {
    if (unreported <= 0) return;
    const units = unreported;
    unreported = 0;
    events.onWalk(units);
  }

  function moveParent(dt: number): boolean {
    const maxStep = WALK_SPEED * dt;
    const direction = directionFromKeys(keys);
    const manual = direction.x !== 0 || direction.z !== 0 || stick.x !== 0 || stick.z !== 0;
    let moved = 0;
    if (manual) {
      route = [];
      const dx = direction.x !== 0 || direction.z !== 0 ? direction.x : stick.x;
      const dz = direction.x !== 0 || direction.z !== 0 ? direction.z : stick.z;
      const length = Math.min(1, Math.hypot(dx, dz));
      const norm = Math.hypot(dx, dz) || 1;
      const next = moveWithCollision(position, {
        x: (dx / norm) * maxStep * length,
        z: (dz / norm) * maxStep * length,
      });
      moved = Math.hypot(next.x - position.x, next.z - position.z);
      position = next;
    } else if (route.length > 0) {
      const follow = followRoute(position, route, maxStep);
      position = follow.position;
      route = follow.route;
      moved = follow.moved;
    }
    return moved > 0;
  }

  function resize(): void {
    const width = Math.max(1, element.clientWidth);
    const height = Math.max(1, element.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    // Pull back on narrow stages so the room stays fully visible.
    const pullBack = Math.max(1, REFERENCE_ASPECT / aspect);
    camera.position.copy(CAMERA_TARGET).addScaledVector(CAMERA_HOME.clone().sub(CAMERA_TARGET), pullBack);
    camera.lookAt(CAMERA_TARGET);
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(element);

  let frame = 0;
  let last = 0;
  let clockTime = 0;

  function render(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clockTime += dt;
    const reduced = reducedMotionQuery.matches;

    let walking = false;
    if (!frozen) {
      const before = position;
      walking = moveParent(dt);
      unreported += Math.hypot(position.x - before.x, position.z - before.z);
    }
    if (!walking) flush();
    else if (unreported >= REPORT_UNITS) flush();
    const zone = nearestZone(position);
    if (zone !== near) {
      near = zone;
      events.onNear(zone);
    }

    const parent = actors.parent;
    parent.goal.set(position.x, 0, position.z);
    if (!walking) {
      const look = facing;
      if (look !== null) parent.goalYaw = Math.atan2(look.x - position.x, look.z - position.z);
    }

    for (const actor of Object.values(actors)) step(actor, clockTime, dt, reduced);
    room.animate(reduced ? 0 : clockTime);

    for (const id of [...KID_IDS, 'parent'] as const) {
      const root = actors[id].rig.root.position;
      tags[id].position.set(root.x, root.y + (id === 'parent' ? 2.55 : id === 'elder' ? 2.2 : 1.95), root.z);
    }
    const bob = reduced ? 0 : Math.sin(clockTime * 4) * 0.08;
    for (const sprite of markerSprites.values()) {
      if (sprite.visible) sprite.position.y = (sprite.userData.baseY as number) + bob;
    }
    if (ring.visible) {
      const pulse = reduced ? 1 : 1 + Math.sin(clockTime * 5) * 0.08;
      ring.scale.setScalar(pulse);
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  return {
    element,
    update(view) {
      const sky = skyAt(view.clock);
      room.setSky(sky, view.clock);
      sun.intensity = 0.25 + sky.daylight * 1.5;
      ambient.intensity = 0.3 + sky.daylight * 0.35;
      lamp.intensity = sky.lamp * 26;

      let faceKid: Point | null = null;
      for (const id of KID_IDS) {
        const kid = view.kids[id];
        const spot = ZONES[kid.zone].kid;
        const point = kidPoint(kid.zone, id);
        const actor = actors[id];
        if (spot !== null && point !== null) {
          actor.goal.set(point.x, spot.y, point.z);
          actor.goalYaw = spot.yaw;
        }
        actor.pose = kid.pose;
        actor.mood = kid.mood;
        if (view.focus === id) faceKid = point;
      }
      if (faceKid === null && near !== null) {
        const here = KID_IDS.map((id) => ({ id, view: view.kids[id] })).find((k) => k.view.zone === near);
        faceKid = here === undefined ? null : kidPoint(near, here.id);
      }
      facing = faceKid;

      const parent = actors.parent;
      parent.pose = 'idle';
      parent.mood = 70;

      const shown = new Set<ZoneId>();
      for (const marker of view.markers) {
        const sprite = markerSprites.get(marker.zone);
        if (sprite === undefined) continue;
        const current = sprite.userData.kind as Marker['kind'] | undefined;
        // An urgent marker wins over a plain one in the same room.
        if (shown.has(marker.zone) && current === 'urgent') continue;
        shown.add(marker.zone);
        sprite.material.map = markerTextures[marker.kind];
        sprite.userData.kind = marker.kind;
        sprite.userData.baseY = markerAnchor(marker.zone).y;
        sprite.visible = true;
      }
      for (const [zone, sprite] of markerSprites) {
        if (!shown.has(zone)) {
          sprite.visible = false;
          sprite.userData.kind = undefined;
        }
      }

      guide = view.target;
      if (guide === null) ring.visible = false;
      else {
        ring.visible = true;
        ring.position.set(ZONES[guide].stand.x, 0.03, ZONES[guide].stand.z);
      }
    },
    setStick(x, z) {
      stick = { x: MathUtils.clamp(x, -1, 1), z: MathUtils.clamp(z, -1, 1) };
    },
    walkTo(zone) {
      if (frozen) return;
      route = planPath(position, ZONES[zone].stand);
    },
    setFrozen(value) {
      frozen = value;
      if (value) {
        route = [];
        stick = { x: 0, z: 0 };
        keys.clear();
        flush();
      }
    },
    reset() {
      position = START_POINT;
      route = [];
      unreported = 0;
      near = null;
      actors.parent.rig.root.position.set(START_POINT.x, 0, START_POINT.z);
      events.onNear(nearestZone(position));
      near = nearestZone(position);
    },
    start() {
      if (frame !== 0) return;
      last = performance.now();
      frame = requestAnimationFrame(render);
      resize();
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      flush();
    },
  };
}
