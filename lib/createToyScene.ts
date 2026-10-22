/**
 * The CafeDuo toy set (DESIGN.md "3D Toys"): matte vinyl toys built from local geometry only.
 * Used live in the landing hero and offline to render the static fallbacks in public/landing/toys.
 */
import {
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
  ConeGeometry,
  Box3,
  Sphere,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const TOY_COLORS = {
  ink: '#17140F',
  paper: '#FFFFFF',
  lokum: '#FF5C8A',
  limon: '#FFD23F',
  gok: '#1FB3FF',
  gokDeep: '#1597D9',
  fistik: '#B6D31B',
  fistikFace: '#C8E23A',
  deniz: '#2EC4B6',
} as const;

export type ToyName = 'knight' | 'cup' | 'coin' | 'tent' | 'quiz' | 'target' | 'ship';
export type ToyLayout = 'hero' | 'single';

export interface ToySceneOptions {
  /** Field colour behind the toys; `null` renders on a transparent canvas. */
  field: string | null;
  layout: ToyLayout;
  /** Toy shown by the `single` layout. */
  only?: ToyName;
  /** Skip every animation and render the resting pose. */
  still?: boolean;
  /** Text on the table tent. */
  tableCode?: string;
  pixelRatio?: number;
}

export interface ToyScene {
  resize: (width: number, height: number) => void;
  setRunning: (running: boolean) => void;
  setPointer: (x: number, y: number) => void;
  /** 0 while the hero is in place, 1 once it has scrolled away: the camera orbits up and around. */
  setScroll: (progress: number) => void;
  /** The knight makes an L-shaped move toward the table tent; resolves when it has landed. */
  playKnightMove: () => Promise<void>;
  renderOnce: () => void;
  dispose: () => void;
}

const FRAME_MS = 1000 / 30;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** Overshoot then settle: the toy "lands". */
const easeOutBack = (t: number) => {
  const c = 1.6;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

function labelTexture(text: string, background: string, size: number, width = 512, height = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = TOY_COLORS.ink;
    context.font = `${size}px "Baloo 2", "Onest", sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, width / 2, height / 2 + size * 0.05);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

interface Toy {
  name: ToyName;
  object: Group;
  rest: { x: number; y: number; z: number; ry: number };
}

export function createToyScene(canvas: HTMLCanvasElement, options: ToySceneOptions): ToyScene {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: options.field === null,
    antialias: true,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.toneMapping = NeutralToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  if (options.field) scene.background = new Color(options.field);
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);

  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const track = <T extends BufferGeometry>(geometry: T) => (geometries.add(geometry), geometry);
  const vinyl = (color: string) => {
    const material = new MeshPhysicalMaterial({
      color,
      roughness: 0.48,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
      sheen: 0.3,
      sheenColor: new Color('#ffffff'),
    });
    materials.add(material);
    return material;
  };
  const decal = (texture: Texture) => {
    textures.add(texture);
    const material = new MeshPhysicalMaterial({ map: texture, roughness: 0.5, clearcoat: 0.3 });
    materials.add(material);
    return material;
  };

  scene.add(new HemisphereLight('#ffffff', options.field ?? '#ffffff', 1.6));
  const key = new DirectionalLight('#ffffff', 2.4);
  key.position.set(-4, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 9;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(key);
  const fill = new DirectionalLight('#ffffff', 0.7);
  fill.position.set(6, 3, -2);
  scene.add(fill);
  const shadowMaterial = new ShadowMaterial({ opacity: 0.18 });
  materials.add(shadowMaterial);
  const floor = new Mesh(track(new PlaneGeometry(40, 40)), shadowMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const castAll = (object: Object3D) =>
    object.traverse((child) => {
      if ((child as Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

  // --- Toys -------------------------------------------------------------------------------
  const knight = () => {
    const group = new Group();
    const shape = new Shape();
    shape.moveTo(-0.62, 0);
    shape.lineTo(0.62, 0);
    shape.bezierCurveTo(0.68, 0.5, 0.44, 0.9, 0.5, 1.4);
    shape.bezierCurveTo(0.56, 1.85, 0.52, 2.3, 0.4, 2.62);
    shape.bezierCurveTo(0.36, 2.85, 0.3, 3.05, 0.2, 3.12);
    shape.bezierCurveTo(0.1, 3.06, 0.05, 2.9, 0.02, 2.76);
    shape.bezierCurveTo(-0.2, 2.78, -0.42, 2.66, -0.6, 2.46);
    shape.bezierCurveTo(-0.82, 2.2, -1.02, 2.0, -1.1, 1.76);
    shape.bezierCurveTo(-1.16, 1.52, -0.98, 1.34, -0.76, 1.42);
    shape.bezierCurveTo(-0.52, 1.5, -0.34, 1.44, -0.3, 1.26);
    shape.bezierCurveTo(-0.55, 0.95, -0.7, 0.5, -0.62, 0);
    const body = new Mesh(
      track(
        new ExtrudeGeometry(shape, {
          depth: 0.55,
          bevelEnabled: true,
          bevelThickness: 0.22,
          bevelSize: 0.16,
          bevelSegments: 10,
          curveSegments: 48,
        })
      ),
      vinyl(TOY_COLORS.gok)
    );
    body.position.set(0, 0.42, -0.27);
    group.add(body);
    const base = new Mesh(
      track(
        new LatheGeometry(
          [
            [0, 0],
            [0.95, 0],
            [1.0, 0.08],
            [0.98, 0.3],
            [0.78, 0.38],
            [0.7, 0.46],
            [0, 0.46],
          ].map(([x, y]) => new Vector2(x, y)),
          64
        )
      ),
      vinyl(TOY_COLORS.gokDeep)
    );
    group.add(base);
    const eyeMaterial = new MeshPhysicalMaterial({
      color: TOY_COLORS.ink,
      roughness: 0.3,
      clearcoat: 1,
    });
    materials.add(eyeMaterial);
    for (const z of [0.44, -0.44]) {
      const eye = new Mesh(track(new SphereGeometry(0.09, 24, 16)), eyeMaterial);
      eye.position.set(-0.36, 2.5, z);
      group.add(eye);
    }
    return group;
  };

  const cup = () => {
    const group = new Group();
    const saucer = new Mesh(
      track(
        new LatheGeometry(
          [
            [0, 0.02],
            [1.05, 0.02],
            [1.2, 0.14],
            [1.15, 0.2],
            [0, 0.12],
          ].map(([x, y]) => new Vector2(x, y)),
          64
        )
      ),
      vinyl(TOY_COLORS.paper)
    );
    group.add(saucer);
    const mug = new Mesh(
      track(
        new LatheGeometry(
          [
            [0, 0.12],
            [0.48, 0.14],
            [0.7, 0.45],
            [0.78, 1.0],
            [0.74, 1.04],
            [0.66, 0.98],
            [0, 0.9],
          ].map(([x, y]) => new Vector2(x, y)),
          64
        )
      ),
      vinyl(TOY_COLORS.lokum)
    );
    group.add(mug);
    const coffeeMaterial = new MeshStandardMaterial({ color: '#5a3424', roughness: 0.35 });
    materials.add(coffeeMaterial);
    const coffee = new Mesh(track(new CircleGeometry(0.66, 48)), coffeeMaterial);
    coffee.rotation.x = -Math.PI / 2;
    coffee.position.y = 0.93;
    group.add(coffee);
    const handle = new Mesh(track(new TorusGeometry(0.26, 0.09, 20, 48)), vinyl(TOY_COLORS.lokum));
    handle.position.set(0.82, 0.62, 0);
    group.add(handle);
    return group;
  };

  let coinFace: Mesh | null = null;
  const coinTexture = (text: string) => labelTexture(text, TOY_COLORS.fistikFace, 170, 512, 512);
  const coin = () => {
    const group = new Group();
    group.add(new Mesh(track(new CylinderGeometry(0.8, 0.8, 0.26, 64)), vinyl(TOY_COLORS.fistik)));
    const face = new Mesh(track(new CircleGeometry(0.66, 64)), decal(coinTexture('100')));
    face.rotation.x = -Math.PI / 2;
    face.position.y = 0.131;
    group.add(face);
    coinFace = face;
    return group;
  };

  const tent = () => {
    const group = new Group();
    const card = track(new RoundedBoxGeometry(1.7, 1.05, 0.08, 4, 0.06));
    const plain = vinyl(TOY_COLORS.paper);
    const face = decal(
      labelTexture(options.tableCode ?? 'MASA07', TOY_COLORS.paper, 118, 640, 400)
    );
    const front = new Mesh(card, [plain, plain, plain, plain, face, plain]);
    front.position.set(0, 0.48, 0.17);
    front.rotation.x = -0.32;
    group.add(front);
    const back = new Mesh(card, plain);
    back.position.set(0, 0.48, -0.17);
    back.rotation.x = 0.32;
    group.add(back);
    return group;
  };

  const quiz = () => {
    const group = new Group();
    const plain = vinyl(TOY_COLORS.limon);
    const face = decal(labelTexture('?', TOY_COLORS.limon, 330, 512, 512));
    const card = new Mesh(track(new RoundedBoxGeometry(1.5, 1.9, 0.18, 6, 0.08)), [
      plain,
      plain,
      plain,
      plain,
      face,
      plain,
    ]);
    card.position.y = 1.15;
    card.rotation.x = -0.12;
    group.add(card);
    const stand = new Mesh(
      track(new RoundedBoxGeometry(1.2, 0.22, 0.7, 4, 0.08)),
      vinyl(TOY_COLORS.paper)
    );
    stand.position.y = 0.11;
    group.add(stand);
    return group;
  };

  const target = () => {
    const group = new Group();
    const rings: Array<[number, string]> = [
      [1.15, TOY_COLORS.lokum],
      [0.92, TOY_COLORS.paper],
      [0.68, TOY_COLORS.lokum],
      [0.44, TOY_COLORS.paper],
      [0.2, TOY_COLORS.ink],
    ];
    rings.forEach(([radius, color], i) => {
      const ring = new Mesh(
        track(new CylinderGeometry(radius, radius, 0.2 + i * 0.04, 64)),
        vinyl(color)
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 1.35, i * 0.02);
      group.add(ring);
    });
    const stand = new Mesh(
      track(new CylinderGeometry(0.12, 0.5, 0.4, 32)),
      vinyl(TOY_COLORS.paper)
    );
    stand.position.y = 0.2;
    group.add(stand);
    const dart = new Group();
    const shaft = new Mesh(track(new CylinderGeometry(0.05, 0.05, 1.0, 16)), vinyl(TOY_COLORS.ink));
    shaft.rotation.x = Math.PI / 2;
    dart.add(shaft);
    const tip = new Mesh(track(new ConeGeometry(0.07, 0.25, 16)), vinyl(TOY_COLORS.ink));
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.6;
    dart.add(tip);
    for (const angle of [0, Math.PI / 2]) {
      const fin = new Mesh(
        track(new RoundedBoxGeometry(0.4, 0.02, 0.3, 2, 0.01)),
        vinyl(TOY_COLORS.limon)
      );
      fin.position.z = 0.42;
      fin.rotation.z = angle;
      dart.add(fin);
    }
    dart.position.set(0.12, 1.45, 0.75);
    dart.rotation.set(0.25, -0.35, 0);
    group.add(dart);
    return group;
  };

  /** Amiral Battı: a vinyl toy battleship, hull in deniz, a white deck house, an ink funnel. */
  const ship = () => {
    const group = new Group();
    // Top-down outline (x along the ship, pointed bow at +x), extruded upward.
    const outline = (scale: number) => {
      const shape = new Shape();
      shape.moveTo(-1.25 * scale, -0.42 * scale);
      shape.lineTo(0.55 * scale, -0.46 * scale);
      shape.bezierCurveTo(1.0 * scale, -0.42 * scale, 1.3 * scale, -0.18 * scale, 1.45 * scale, 0);
      shape.bezierCurveTo(
        1.3 * scale,
        0.18 * scale,
        1.0 * scale,
        0.42 * scale,
        0.55 * scale,
        0.46 * scale
      );
      shape.lineTo(-1.25 * scale, 0.42 * scale);
      shape.bezierCurveTo(
        -1.42 * scale,
        0.4 * scale,
        -1.42 * scale,
        -0.4 * scale,
        -1.25 * scale,
        -0.42 * scale
      );
      return shape;
    };
    const hull = new Mesh(
      track(
        new ExtrudeGeometry(outline(1), {
          depth: 0.42,
          bevelEnabled: true,
          bevelThickness: 0.12,
          bevelSize: 0.1,
          bevelSegments: 8,
          curveSegments: 40,
        })
      ),
      vinyl(TOY_COLORS.deniz)
    );
    hull.rotation.x = -Math.PI / 2;
    hull.position.y = 0.12;
    group.add(hull);
    const deck = new Mesh(
      track(
        new ExtrudeGeometry(outline(0.86), { depth: 0.06, bevelEnabled: false, curveSegments: 40 })
      ),
      vinyl(TOY_COLORS.paper)
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.67;
    group.add(deck);
    const house = new Mesh(
      track(new RoundedBoxGeometry(0.95, 0.5, 0.56, 4, 0.1)),
      vinyl(TOY_COLORS.paper)
    );
    house.position.set(-0.3, 0.98, 0);
    group.add(house);
    const bridge = new Mesh(
      track(new RoundedBoxGeometry(0.5, 0.34, 0.44, 4, 0.08)),
      vinyl(TOY_COLORS.paper)
    );
    bridge.position.set(-0.18, 1.38, 0);
    group.add(bridge);
    const funnel = new Mesh(
      track(new CylinderGeometry(0.15, 0.18, 0.5, 32)),
      vinyl(TOY_COLORS.ink)
    );
    funnel.position.set(-0.62, 1.42, 0);
    group.add(funnel);
    const windowMaterial = new MeshPhysicalMaterial({
      color: TOY_COLORS.ink,
      roughness: 0.3,
      clearcoat: 1,
    });
    materials.add(windowMaterial);
    for (const x of [-0.6, -0.3, 0]) {
      const porthole = new Mesh(track(new CircleGeometry(0.075, 24)), windowMaterial);
      porthole.position.set(x, 0.98, 0.285);
      group.add(porthole);
    }
    const turret = new Mesh(
      track(new CylinderGeometry(0.24, 0.27, 0.18, 32)),
      vinyl(TOY_COLORS.deniz)
    );
    turret.position.set(0.62, 0.79, 0);
    group.add(turret);
    const barrel = new Mesh(
      track(new CylinderGeometry(0.05, 0.05, 0.55, 16)),
      vinyl(TOY_COLORS.ink)
    );
    barrel.rotation.z = -Math.PI / 2 + 0.12;
    barrel.position.set(0.92, 0.84, 0);
    group.add(barrel);
    return group;
  };

  const builders: Record<ToyName, () => Group> = { knight, cup, coin, tent, quiz, target, ship };
  const toys: Toy[] = [];
  const addToy = (
    name: ToyName,
    x: number,
    y: number,
    z: number,
    ry: number,
    scale = 1,
    rx = 0,
    rz = 0
  ) => {
    const object = builders[name]();
    object.position.set(x, y, z);
    object.rotation.set(rx, ry, rz);
    object.scale.setScalar(scale);
    castAll(object);
    scene.add(object);
    toys.push({ name, object, rest: { x, y, z, ry } });
    return object;
  };

  /** Where the knight lands after its move: in front of the table tent, clear of the other toys. */
  const KNIGHT_TARGET = { x: 1.85, y: 0, z: -0.25, ry: -0.5 };
  if (options.layout === 'hero') {
    addToy('knight', -2.1, 0, 0.1, 0.55, 1.25);
    addToy('cup', 0.5, 0, -1.9, -0.4);
    addToy('coin', -0.45, 0.95, 2.35, 0.2, 1, 0.55, -0.35);
    addToy('tent', 3.35, 0, -0.45, -0.55);
  } else {
    addToy(options.only ?? 'knight', 0, 0, 0, options.only === 'tent' ? -0.35 : 0.45, 1.2);
  }

  // Frame the set: fit its bounding sphere (and the knight's landing spot) into the view.
  const bounds = new Box3();
  toys.forEach((toy) => bounds.expandByObject(toy.object));
  if (options.layout === 'hero')
    bounds.expandByPoint(new Vector3(KNIGHT_TARGET.x, 2.5, KNIGHT_TARGET.z));
  const sphere = bounds.getBoundingSphere(new Sphere());
  const viewDirection = new Vector3(0, 0.62, 1).normalize();
  const lookAt = { x: sphere.center.x, y: sphere.center.y };
  const frame = (width: number, height: number) => {
    camera.aspect = width / Math.max(1, height);
    camera.fov = 30;
    const vertical = (camera.fov * Math.PI) / 180;
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const zoom = options.layout === 'hero' ? 0.68 : 0.92;
    const distance = (sphere.radius / Math.sin(Math.min(vertical, horizontal) / 2)) * zoom;
    camera.position.copy(sphere.center).addScaledVector(viewDirection, distance);
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
  };

  // --- Motion -----------------------------------------------------------------------------
  const start = performance.now();
  let running = false;
  let raf = 0;
  let last = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const orbit = { value: 0, target: 0 };
  let move: { t0: number; done: () => void } | null = null;
  let flip: { t0: number; swapped: boolean } | null = null;
  const knightToy = toys.find((toy) => toy.name === 'knight');
  const tentToy = toys.find((toy) => toy.name === 'tent');
  const coinToy = toys.find((toy) => toy.name === 'coin');
  let knightHome = true;
  const knightHomePose = knightToy ? { ...knightToy.rest } : KNIGHT_TARGET;

  const pose = (now: number) => {
    const t = (now - start) / 1000;
    toys.forEach((toy, index) => {
      const { object, rest } = toy;
      // Entrance: each toy drops onto the table in turn and lands with a small squash.
      const local = Math.min(1, Math.max(0, (t - 0.15 - index * 0.14) / 0.75));
      const drop = options.still ? 0 : (1 - easeOutBack(local)) * 3.2;
      const squash =
        options.still || local >= 1 ? 0 : Math.sin(local * Math.PI) * 0.12 * (local > 0.6 ? 1 : 0);
      object.position.y = rest.y + Math.max(-0.2, drop);
      object.scale.y = object.scale.x * (1 - squash);
      // Idle: a slow sway, different per toy.
      if (!options.still && local >= 1)
        object.rotation.y = rest.ry + Math.sin(t * 0.8 + index) * 0.06;
    });

    if (move && knightToy) {
      const p = Math.min(1, (now - move.t0) / 900);
      const from = knightHome ? knightToy.rest : KNIGHT_TARGET;
      const to = knightHome ? KNIGHT_TARGET : knightHomePose;
      // An L: forward first, then sideways, lifted on an arc.
      const a = easeOut(Math.min(1, p / 0.6));
      const b = easeOut(Math.max(0, (p - 0.4) / 0.6));
      knightToy.object.position.x = from.x + (to.x - from.x) * b;
      knightToy.object.position.z = from.z + (to.z - from.z) * a;
      knightToy.object.position.y = Math.sin(p * Math.PI) * 1.6;
      knightToy.object.rotation.y = from.ry + (to.ry - from.ry) * p;
      if (p >= 1) {
        knightHome = !knightHome;
        knightToy.rest.x = to.x;
        knightToy.rest.z = to.z;
        knightToy.rest.ry = to.ry;
        const done = move.done;
        move = null;
        if (!knightHome) flip = { t0: now, swapped: false };
        done();
      }
    }
    if (flip && coinToy && coinFace) {
      const p = Math.min(1, (now - flip.t0) / 700);
      coinToy.object.rotation.x = 0.55 + easeOut(p) * Math.PI * 2;
      coinToy.object.position.y = coinToy.rest.y + Math.sin(p * Math.PI) * 1.2;
      if (!flip.swapped && p > 0.5) {
        flip.swapped = true;
        const material = coinFace.material as MeshPhysicalMaterial;
        material.map?.dispose();
        material.map = coinTexture('+20');
        textures.add(material.map);
        material.needsUpdate = true;
      }
      if (tentToy) tentToy.object.rotation.z = Math.sin(p * Math.PI * 3) * 0.12 * (1 - p);
      if (p >= 1) flip = null;
    }

    pointer.x += (pointer.tx - pointer.x) * 0.08;
    pointer.y += (pointer.ty - pointer.y) * 0.08;
    orbit.value += (orbit.target - orbit.value) * 0.1;
    // Orbit around the set: the pointer leans the view, scrolling lifts it and turns it away.
    const yaw = pointer.x * 0.12 + orbit.value * 0.45;
    const lift = orbit.value * 0.35 - pointer.y * 0.04;
    const offset = camera.position.clone().sub(sphere.center).length();
    const direction = viewDirection.clone();
    direction.y += lift;
    direction.normalize().applyAxisAngle(new Vector3(0, 1, 0), yaw);
    camera.position.copy(sphere.center).addScaledVector(direction, offset);
    camera.lookAt(lookAt.x, lookAt.y, sphere.center.z);
  };

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - last < FRAME_MS) return;
    last = now;
    pose(now);
    renderer.render(scene, camera);
  };

  return {
    resize: (width, height) => {
      renderer.setSize(width, height, false);
      frame(width, height);
      pose(options.still ? start + 60_000 : performance.now());
      renderer.render(scene, camera);
    },
    setRunning: (next) => {
      if (next === running) return;
      running = next;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(tick);
    },
    setScroll: (progress) => {
      orbit.target = Math.max(0, Math.min(1, progress));
    },
    setPointer: (x, y) => {
      pointer.tx = Math.max(-1, Math.min(1, x));
      pointer.ty = Math.max(-1, Math.min(1, y));
    },
    playKnightMove: () =>
      new Promise<void>((resolve) => {
        if (move) return resolve();
        move = { t0: performance.now(), done: resolve };
        if (!running) {
          // Without the loop (reduced motion), jump straight to the end state.
          pose(performance.now() + 2000);
          if (move) pose(move.t0 + 1000);
          if (flip) pose(flip.t0 + 1000);
          renderer.render(scene, camera);
        }
      }),
    renderOnce: () => {
      pose(options.still ? start + 60_000 : performance.now());
      renderer.render(scene, camera);
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
    },
  };
}
