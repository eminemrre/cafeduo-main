import {
  AmbientLight,
  ACESFilmicToneMapping,
  CircleGeometry,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RGBAFormat,
  Scene,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface CafeScene {
  setRunning: (running: boolean) => void;
  setPointer: (x: number, y: number) => void;
  setChapter: (chapter: number) => void;
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

  const token = new Group();
  token.position.set(1.2, 1.75, -0.42);
  token.rotation.set(1.1, 0.35, -0.35);
  composition.add(token);
  mesh(new CylinderGeometry(0.54, 0.54, 0.16, 48), blue, token);
  const tokenRim = mesh(new TorusGeometry(0.46, 0.025, 8, 48), cream, token);
  tokenRim.rotation.x = -Math.PI / 2;
  tokenRim.position.y = 0.085;
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

  let frame = 0,
    disposed = false,
    running = false,
    last = 0,
    elapsed = 0;
  let targetX = 0,
    targetY = 0,
    chapter = 0,
    currentChapter = 0;
  const render = (time = 0) => {
    if (disposed) return;
    frame = 0;
    if (running && last && time - last < 1000 / 30) {
      frame = requestAnimationFrame(render);
      return;
    }
    const delta = last ? Math.min((time - last) / 1000, 0.06) : 0;
    last = time;
    if (running) elapsed += delta;
    composition.rotation.y +=
      (targetX * 0.16 - currentChapter * 0.16 - composition.rotation.y) * 0.07;
    composition.rotation.x += (targetY * 0.08 - composition.rotation.x) * 0.07;
    currentChapter += (chapter - currentChapter) * 0.06;
    cup.position.y = 0.12 + (running ? Math.sin(elapsed * 0.8) * 0.035 : 0);
    token.position.y = 1.75 + (running ? Math.sin(elapsed * 0.9 + 1) * 0.1 : 0);
    token.rotation.z = -0.35 + (running ? Math.sin(elapsed * 0.55) * 0.13 : 0);
    knight.position.x = 0.78 + currentChapter * 0.09;
    renderer.render(scene, camera);
    if (running) frame = requestAnimationFrame(render);
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const framing = Math.min(1, camera.aspect);
    camera.position.set(0, 3.1 / framing, 8.3 / framing);
    camera.lookAt(0, 0.05, 0);
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
      if (disposed || running === value) return;
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
    },
    setChapter(value) {
      chapter = value;
      if (!running) {
        currentChapter = value;
        render();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      running = false;
      cancelAnimationFrame(frame);
      canvas.removeEventListener('webglcontextlost', lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      environment.dispose();
      shadowTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
    },
  };
}
