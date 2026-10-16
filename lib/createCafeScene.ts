import {
  AmbientLight,
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  STORY_START,
  confettiProgress,
  easeOutBack,
  easeOutExpo,
  knightHop,
  seeded,
  smoothstep,
  storyPose,
  tokenSpin,
} from './cafeStory';

export interface CafeScene {
  setRunning: (running: boolean) => void;
  setPointer: (x: number, y: number) => void;
  setChapter: (chapter: number) => void;
  /** Story position from -1 (opening shot) to 2 (reward); see lib/cafeStory.ts. */
  setProgress: (story: number) => void;
  resize: () => void;
  dispose: () => void;
}

/** Local geometry and lighting only: no third-party models, shaders or network textures. */
export function createCafeScene(canvas: HTMLCanvasElement): CafeScene {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 3.1, 8.3);
  camera.lookAt(0, 0.05, 0);
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.65;
  room.dispose();
  pmrem.dispose();
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const material = (color: string, roughness = 0.25) => {
    const value = new MeshPhysicalMaterial({
      color,
      roughness,
      metalness: 0.05,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
    });
    materials.add(value);
    return value;
  };
  const cream = material('#fff3df');
  const pink = material('#ed82b4');
  const blue = material('#3966dd');
  const brown = material('#4b2418', 0.17);
  const gold = material('#e9ba70', 0.3);
  const dark = material('#23315d', 0.3);
  const mesh = (geometry: BufferGeometry, surface: Material, parent: Group | Scene) => {
    geometries.add(geometry);
    const object = new Mesh(geometry, surface);
    parent.add(object);
    return object;
  };
  scene.add(new AmbientLight('#fff6ea', 0.6));
  const key = new DirectionalLight('#fff5dd', 2.2);
  key.position.set(-4, 6, 5);
  scene.add(key);
  const rim = new DirectionalLight('#a3b8ff', 1.3);
  rim.position.set(5, 3, -4);
  scene.add(rim);
  const composition = new Group();
  scene.add(composition);
  const cup = new Group();
  cup.position.set(-0.62, 0.15, 0);
  cup.rotation.set(0.08, -0.3, -0.14);
  composition.add(cup);
  // Hollow lathed ceramic profile, rather than a solid cylinder pretending to be a cup.
  const profile = [
    [0.42, 0],
    [0.53, 0.05],
    [0.62, 0.18],
    [0.73, 0.8],
    [0.75, 1.14],
    [0.72, 1.19],
    [0.68, 1.15],
    [0.65, 0.85],
    [0.56, 0.22],
    [0.42, 0.16],
  ].map(([x, y]) => new Vector2(x, y));
  mesh(new LatheGeometry(profile, 64), cream, cup);
  const handle = mesh(new TorusGeometry(0.37, 0.12, 12, 48), cream, cup);
  handle.position.set(0.78, 0.69, 0);
  const coffee = mesh(new CircleGeometry(0.655, 64), brown, cup);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 1.075;
  const crema = mesh(new TorusGeometry(0.29, 0.011, 6, 60), gold, cup);
  crema.rotation.x = -Math.PI / 2;
  crema.position.set(0.05, 1.08, 0.04);
  const saucer = mesh(new CylinderGeometry(1.04, 0.92, 0.11, 64), cream, cup);
  saucer.position.y = -0.02;
  const lip = mesh(new TorusGeometry(0.94, 0.05, 8, 64), cream, cup);
  lip.rotation.x = -Math.PI / 2;
  lip.position.y = 0.04;

  const knight = new Group();
  knight.position.set(0.78, -0.08, 0.48);
  knight.rotation.set(0.02, -0.5, 0.12);
  knight.scale.setScalar(0.9);
  composition.add(knight);
  const baseProfile = [
    [0.65, 0],
    [0.66, 0.12],
    [0.53, 0.22],
    [0.45, 0.28],
    [0.43, 0.43],
    [0.32, 0.48],
    [0.26, 0.68],
  ].map(([x, y]) => new Vector2(x, y));
  mesh(new LatheGeometry(baseProfile, 48), pink, knight);
  const horse = new Shape();
  horse.moveTo(-0.34, 0.56);
  horse.bezierCurveTo(-0.32, 1.14, -0.12, 1.62, 0.2, 1.79);
  horse.lineTo(0.21, 2.08);
  horse.lineTo(0.43, 1.88);
  horse.lineTo(0.63, 1.65);
  horse.lineTo(0.92, 1.42);
  horse.quadraticCurveTo(0.94, 1.24, 0.78, 1.2);
  horse.lineTo(0.47, 1.27);
  horse.quadraticCurveTo(0.25, 0.97, 0.46, 0.56);
  horse.closePath();
  const head = mesh(
    new ExtrudeGeometry(horse, {
      depth: 0.34,
      bevelEnabled: true,
      bevelSize: 0.09,
      bevelThickness: 0.08,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 20,
    }),
    pink,
    knight
  );
  head.position.set(-0.14, 0, -0.17);
  const eye = mesh(new SphereGeometry(0.038, 12, 12), dark, knight);
  eye.position.set(0.32, 1.61, 0.28);

  // The pivot carries position and the scroll spin; the token inside keeps its tilt.
  const tokenPivot = new Group();
  composition.add(tokenPivot);
  const token = new Group();
  token.rotation.set(1.1, 0.35, -0.35);
  tokenPivot.add(token);
  mesh(new CylinderGeometry(0.54, 0.54, 0.16, 48), blue, token);
  const tokenRim = mesh(new TorusGeometry(0.46, 0.025, 8, 48), cream, token);
  tokenRim.rotation.x = -Math.PI / 2;
  tokenRim.position.y = 0.085;
  const tokenBack = mesh(new TorusGeometry(0.46, 0.025, 8, 48), cream, token);
  tokenBack.rotation.x = Math.PI / 2;
  tokenBack.position.y = -0.085;
  // Both faces carry the CafeDuo mark, drawn locally so no image asset is fetched.
  const markCanvas = document.createElement('canvas');
  markCanvas.width = markCanvas.height = 256;
  const markContext = markCanvas.getContext('2d');
  if (markContext) {
    markContext.fillStyle = '#3966dd';
    markContext.fillRect(0, 0, 256, 256);
    markContext.fillStyle = '#fff3df';
    markContext.font = '800 112px "DM Sans Variable", "DM Sans", system-ui, sans-serif';
    markContext.textAlign = 'center';
    markContext.textBaseline = 'middle';
    markContext.fillText('CD', 128, 136);
  }
  const markTexture = new CanvasTexture(markCanvas);
  markTexture.colorSpace = SRGBColorSpace;
  textures.add(markTexture);
  const markMaterial = new MeshStandardMaterial({ map: markTexture, roughness: 0.3 });
  materials.add(markMaterial);
  const markGeometry = new CircleGeometry(0.43, 48);
  geometries.add(markGeometry);
  const front = new Mesh(markGeometry, markMaterial);
  front.rotation.x = -Math.PI / 2;
  front.position.y = 0.082;
  const back = new Mesh(markGeometry, markMaterial);
  back.rotation.set(Math.PI / 2, 0, Math.PI);
  back.position.y = -0.082;
  token.add(front, back);
  const orbit = mesh(new TorusGeometry(2.25, 0.015, 6, 96), blue, composition);
  orbit.rotation.set(1.12, 0.25, -0.34);
  orbit.position.y = 0.45;
  const mini = mesh(new SphereGeometry(0.14, 20, 16), blue, composition);
  mini.position.set(-1.7, 1.85, -0.25);
  const drop = mesh(new SphereGeometry(0.08, 16, 12), pink, composition);
  drop.position.set(1.75, 0.32, 0.2);
  const platform = mesh(new CylinderGeometry(2.15, 2.15, 0.14, 64), blue, scene);
  platform.position.set(0, -0.55, 0);
  // A local radial alpha texture keeps contact shadows soft without shadow-map rendering.
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const distance = Math.min(1, Math.hypot(x - 31.5, y - 31.5) / 32);
      pixels[(y * 64 + x) * 4 + 3] = Math.round((1 - distance) ** 2 * 110);
    }
  const shadowTexture = new DataTexture(pixels, 64, 64, RGBAFormat);
  shadowTexture.needsUpdate = true;
  textures.add(shadowTexture);
  const shadowMaterial = new MeshStandardMaterial({
    color: '#1e2960',
    map: shadowTexture,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  materials.add(shadowMaterial);
  const shadow = mesh(new PlaneGeometry(3.3, 2.6), shadowMaterial, scene);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, -0.468, 0.03);

  // Chapter 2 turns the platform into a board: an 8x8 checker texture that fades in.
  const checker = new Uint8Array(8 * 8 * 4);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const light = (x + y) % 2 === 0;
      checker.set(light ? [255, 243, 223, 255] : [154, 175, 217, 255], (y * 8 + x) * 4);
    }
  const boardTexture = new DataTexture(checker, 8, 8, RGBAFormat);
  boardTexture.magFilter = NearestFilter;
  boardTexture.colorSpace = SRGBColorSpace;
  boardTexture.needsUpdate = true;
  textures.add(boardTexture);
  const boardMaterial = new MeshStandardMaterial({
    map: boardTexture,
    roughness: 0.45,
    transparent: true,
    opacity: 0,
  });
  materials.add(boardMaterial);
  const board = mesh(new CircleGeometry(1.98, 64), boardMaterial, scene);
  board.rotation.x = -Math.PI / 2;
  board.position.set(0, -0.476, 0);

  // The opponent: a blue pawn that rises out of the board.
  const rival = new Group();
  composition.add(rival);
  const pawnProfile = [
    [0.5, 0],
    [0.52, 0.1],
    [0.4, 0.2],
    [0.24, 0.32],
    [0.17, 0.75],
    [0.3, 0.82],
    [0.3, 0.88],
    [0.12, 0.92],
  ].map(([x, y]) => new Vector2(x, y));
  mesh(new LatheGeometry(pawnProfile, 40), blue, rival);
  const pawnHead = mesh(new SphereGeometry(0.27, 28, 20), blue, rival);
  pawnHead.position.y = 1.12;

  // Soft steam: sprites with a local radial texture rising and curling out of the cup.
  const puffPixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const distance = Math.min(1, Math.hypot(x - 15.5, y - 15.5) / 16);
      puffPixels.set([255, 255, 255, Math.round((1 - distance) ** 2 * 255)], (y * 32 + x) * 4);
    }
  const puffTexture = new DataTexture(puffPixels, 32, 32, RGBAFormat);
  puffTexture.needsUpdate = true;
  textures.add(puffTexture);
  const steam = Array.from({ length: 12 }, (_, index) => {
    const spriteMaterial = new SpriteMaterial({
      map: puffTexture,
      color: '#d8c8b4',
      transparent: true,
      depthWrite: false,
      opacity: 0,
    });
    materials.add(spriteMaterial);
    const sprite = new Sprite(spriteMaterial);
    cup.add(sprite);
    return { sprite, material: spriteMaterial, phase: index / 12 };
  });

  // Reward confetti and ambient particles are instanced, one draw call each.
  const dummy = new Object3D();
  const palette = ['#ed82b4', '#3966dd', '#e9ba70', '#fff3df'].map((value) => new Color(value));
  const confettiMaterial = new MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });
  materials.add(confettiMaterial);
  const confettiGeometry = new BoxGeometry(0.09, 0.09, 0.02);
  geometries.add(confettiGeometry);
  const confetti = new InstancedMesh(confettiGeometry, confettiMaterial, 56);
  composition.add(confetti);
  const random = seeded(7);
  const pieces = Array.from({ length: confetti.count }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const lift = 0.35 + random() * 0.9;
    const speed = 0.9 + random() * 1.2;
    confetti.setColorAt(index, palette[index % palette.length]);
    return {
      direction: [Math.cos(angle) * speed, lift * speed, Math.sin(angle) * speed * 0.6],
      spin: [random() * 14 - 7, random() * 14 - 7],
    };
  });
  const particleGeometry = new SphereGeometry(1, 12, 10);
  geometries.add(particleGeometry);
  const particleMaterial = new MeshStandardMaterial({ roughness: 0.3 });
  materials.add(particleMaterial);
  const particles = new InstancedMesh(particleGeometry, particleMaterial, 26);
  scene.add(particles);
  const motes = Array.from({ length: particles.count }, (_, index) => {
    particles.setColorAt(index, palette[(index + 1) % palette.length]);
    return {
      angle: random() * Math.PI * 2,
      radius: 2.5 + random() * 1.1,
      height: -0.2 + random() * 2.7,
      size: 0.03 + random() * 0.06,
      depth: 0.4 + random() * 1.2,
      drift: (random() > 0.5 ? 1 : -1) * (0.04 + random() * 0.05),
    };
  });

  let frame = 0,
    disposed = false,
    running = false,
    last = 0,
    elapsed = 0,
    // The opening assembly plays once, the first time the scene runs.
    intro = 0,
    moving = true;
  let targetX = 0,
    targetY = 0,
    pointerX = 0,
    pointerY = 0,
    storyTarget: number = STORY_START,
    story: number = STORY_START;

  const apply = (delta: number) => {
    const ease = 1 - Math.exp(-delta * 6);
    if (running) {
      intro = Math.min(1, intro + delta / 1.8);
      story += (storyTarget - story) * (1 - Math.exp(-delta * 7));
      pointerX += (targetX - pointerX) * ease;
      pointerY += (targetY - pointerY) * ease;
    } else {
      story = storyTarget;
      pointerX = targetX;
      pointerY = targetY;
    }
    const pose = storyPose(story);
    const settle = easeOutExpo(intro);
    const pop = (start: number) => easeOutBack(Math.min(1, Math.max(0, (intro - start) / 0.55)));

    const framing = Math.min(1, camera.aspect);
    const [lx, ly, lz] = pose.look;
    camera.position.set(
      lx + (pose.camera[0] - lx + pointerX * 0.45) / framing,
      ly + (pose.camera[1] - ly + pointerY * 0.3) / framing,
      lz + (pose.camera[2] - lz) / framing
    );
    camera.lookAt(lx, ly, lz);

    composition.scale.setScalar(0.72 + 0.28 * pop(0));
    composition.position.y = (1 - settle) * -0.9;
    composition.rotation.y = pointerX * 0.35 - (1 - settle) * 0.9;
    composition.rotation.x = pointerY * 0.12;

    cup.position.set(...pose.cup.position);
    cup.position.y += running ? Math.sin(elapsed * 0.8) * 0.035 : 0;
    cup.scale.setScalar(pose.cup.scale);
    cup.rotation.y = -0.3 + pose.cup.turn;

    const hop = knightHop(story);
    knight.position.set(...pose.knight.position);
    knight.position.y += hop;
    knight.rotation.set(0.02, -0.5 + pose.knight.turn, 0.12 + hop * 0.25);
    knight.scale.setScalar(pose.knight.scale * pop(0.12));

    rival.position.set(...pose.rival.position);
    rival.scale.setScalar(Math.max(0.0001, pose.rival.scale));

    tokenPivot.position.set(...pose.token.position);
    tokenPivot.position.y += running
      ? Math.sin(elapsed * 0.9 + 1) * 0.1 * (1 - pose.token.face)
      : 0;
    tokenPivot.rotation.y = tokenSpin(story);
    tokenPivot.scale.setScalar(pose.token.scale * pop(0.25));
    token.rotation.set(
      1.1 + (Math.PI / 2 - 1.1) * pose.token.face,
      0.35 * (1 - pose.token.face),
      -0.35 * (1 - pose.token.face) + (running ? Math.sin(elapsed * 0.55) * 0.13 : 0)
    );

    // The orbit ring closes in behind the token and becomes its halo.
    const ring = Math.min(1, Math.max(0, (intro - 0.35) / 0.65));
    orbit.scale.setScalar(easeOutExpo(ring) * (1 - pose.halo * 0.42));
    orbit.position.set(0, 0.45 + pose.halo * 0.7, pose.halo * 0.35);
    orbit.rotation.set(
      1.12 * (1 - pose.halo),
      0.25 * (1 - pose.halo),
      -0.34 * (1 - pose.halo) + elapsed * 0.2 * pose.halo
    );
    mini.position.set(-1.7, 1.85 + (running ? Math.sin(elapsed * 1.1) * 0.08 : 0), -0.25);
    drop.position.set(1.75, 0.32 + (running ? Math.sin(elapsed * 1.4 + 2) * 0.06 : 0), 0.2);

    boardMaterial.opacity = pose.board;
    board.visible = pose.board > 0.01;

    for (const { sprite, material: puff, phase } of steam) {
      const rise = (elapsed * 0.28 + phase) % 1;
      sprite.position.set(
        Math.sin(elapsed * 1.3 + phase * 9) * 0.12 * rise,
        1.2 + rise * 1.5,
        Math.cos(elapsed + phase * 7) * 0.08
      );
      sprite.scale.setScalar(0.22 + rise * 0.55);
      puff.opacity = pose.steam * Math.sin(Math.PI * rise) * 0.5;
    }

    const burst = confettiProgress(story);
    confetti.visible = burst > 0;
    if (confetti.visible) {
      const fade = (1 - smoothstep(0.72, 1, burst)) * Math.min(1, burst * 8);
      pieces.forEach(({ direction, spin }, index) => {
        dummy.position.set(
          pose.token.position[0] + direction[0] * burst * 1.6,
          pose.token.position[1] + direction[1] * burst * 1.6 - 2.1 * burst * burst,
          pose.token.position[2] + direction[2] * burst * 1.6
        );
        dummy.rotation.set(spin[0] * burst, spin[1] * burst, 0);
        dummy.scale.setScalar(fade);
        dummy.updateMatrix();
        confetti.setMatrixAt(index, dummy.matrix);
      });
      confetti.instanceMatrix.needsUpdate = true;
    }

    const glow = Math.min(1, Math.max(0, (intro - 0.4) / 0.6));
    motes.forEach((mote, index) => {
      const angle = mote.angle + elapsed * mote.drift;
      dummy.position.set(
        Math.cos(angle) * mote.radius - pointerX * mote.depth,
        mote.height + Math.sin(elapsed * 0.8 + index) * 0.12 + pointerY * mote.depth * 0.5,
        Math.sin(angle) * mote.radius * 0.6
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(mote.size * glow);
      dummy.updateMatrix();
      particles.setMatrixAt(index, dummy.matrix);
    });
    particles.instanceMatrix.needsUpdate = true;

    return (
      intro < 1 ||
      Math.abs(storyTarget - story) > 0.001 ||
      Math.abs(targetX - pointerX) > 0.001 ||
      Math.abs(targetY - pointerY) > 0.001
    );
  };

  const render = (time = 0) => {
    if (disposed) return;
    frame = 0;
    const delta = last ? Math.min((time - last) / 1000, 0.06) : 0;
    // Full frame rate while the story or pointer is moving; idle floating drops to 30 fps.
    if (running && last && !moving && time - last < 1000 / 30) {
      frame = requestAnimationFrame(render);
      return;
    }
    last = time;
    if (running) elapsed += delta;
    moving = apply(delta);
    renderer.render(scene, camera);
    if (running) frame = requestAnimationFrame(render);
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!running) render();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
  };
  canvas.addEventListener('webglcontextlost', lost);
  resize();
  return {
    resize,
    setRunning(value) {
      if (disposed) return;
      if (!value) {
        // Without motion the assembly is skipped and every pose is shown at rest.
        intro = 1;
        if (!running) return render();
      }
      if (running === value) return;
      running = value;
      cancelAnimationFrame(frame);
      last = 0;
      frame = 0;
      if (running) frame = requestAnimationFrame(render);
      else render();
    },
    setPointer(x, y) {
      targetX = x;
      targetY = y;
      if (!running) render();
    },
    setChapter(value) {
      storyTarget = value;
      if (!running) render();
    },
    setProgress(value) {
      storyTarget = value;
      if (!running) render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      confetti.dispose();
      particles.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
    },
  };
}
