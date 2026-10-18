/**
 * Timeline for the hero's scroll story. The story position `s` runs from -1 to 2:
 * -1 is the opening shot, then 0 "Kahveni al", 1 "Oyuna katıl", 2 "Ödülünü seç".
 * Poses are keyframes at whole numbers; in between they ease with smoothstep, so
 * scrolling backwards plays the story in reverse. Pure maths, no three.js, so the
 * choreography is unit tested while the WebGL scene stays a thin renderer.
 */

export type Vec3 = [number, number, number];

export interface StoryPose {
  camera: Vec3;
  look: Vec3;
  cup: { position: Vec3; scale: number; turn: number };
  knight: { position: Vec3; scale: number; turn: number };
  rival: { position: Vec3; scale: number };
  token: { position: Vec3; scale: number; face: number };
  halo: number;
  board: number;
  steam: number;
}

export const STORY_START = -1;
export const STORY_END = 2;

const KEYS: StoryPose[] = [
  {
    camera: [0, 3.1, 8.3],
    look: [0, 0.05, 0],
    cup: { position: [-0.62, 0.15, 0], scale: 1, turn: 0 },
    knight: { position: [0.78, -0.08, 0.48], scale: 0.9, turn: 0 },
    rival: { position: [-0.95, -1.3, 0.05], scale: 0 },
    token: { position: [1.2, 1.75, -0.42], scale: 1, face: 0 },
    halo: 0,
    board: 0,
    steam: 0.55,
  },
  {
    camera: [-0.9, 2.5, 6.9],
    look: [-0.5, 0.55, 0],
    cup: { position: [-0.62, 0.15, 0], scale: 1.12, turn: 0.9 },
    knight: { position: [1.45, -0.08, 0.15], scale: 0.82, turn: 0.3 },
    rival: { position: [-0.95, -1.3, 0.05], scale: 0 },
    token: { position: [1.75, 2.15, -0.9], scale: 0.85, face: 0 },
    halo: 0,
    board: 0,
    steam: 1,
  },
  {
    camera: [0, 5.4, 6.2],
    look: [0, -0.3, 0],
    cup: { position: [-1.55, 0.05, -1.55], scale: 0.7, turn: 1.6 },
    knight: { position: [0.95, -0.47, 0.05], scale: 0.8, turn: 3.2 },
    rival: { position: [-0.95, -0.47, 0.05], scale: 0.85 },
    token: { position: [1.55, 2.35, -1.1], scale: 0.8, face: 0.2 },
    halo: 0,
    board: 1,
    steam: 0.25,
  },
  {
    camera: [0, 2.5, 8.2],
    look: [0, 0.85, 0.2],
    cup: { position: [-1.8, 0.05, -1.7], scale: 0.62, turn: 2 },
    knight: { position: [1.3, -0.47, -0.55], scale: 0.72, turn: 3.6 },
    rival: { position: [-1.3, -0.47, -0.55], scale: 0.7 },
    token: { position: [0, 1.15, 0.7], scale: 1.75, face: 1 },
    halo: 1,
    board: 0.55,
    steam: 0.15,
  },
];

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
export const easeOutBack = (t: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

export function storyPose(story: number): StoryPose {
  const s = clamp(story, STORY_START, STORY_END) - STORY_START;
  const index = Math.min(Math.floor(s), KEYS.length - 2);
  const t = smoothstep(0, 1, s - index);
  const a = KEYS[index];
  const b = KEYS[index + 1];
  return {
    camera: mixVec(a.camera, b.camera, t),
    look: mixVec(a.look, b.look, t),
    cup: {
      position: mixVec(a.cup.position, b.cup.position, t),
      scale: mix(a.cup.scale, b.cup.scale, t),
      turn: mix(a.cup.turn, b.cup.turn, t),
    },
    knight: {
      position: mixVec(a.knight.position, b.knight.position, t),
      scale: mix(a.knight.scale, b.knight.scale, t),
      turn: mix(a.knight.turn, b.knight.turn, t),
    },
    rival: {
      position: mixVec(a.rival.position, b.rival.position, t),
      scale: mix(a.rival.scale, b.rival.scale, t),
    },
    token: {
      position: mixVec(a.token.position, b.token.position, t),
      scale: mix(a.token.scale, b.token.scale, t),
      face: mix(a.token.face, b.token.face, t),
    },
    halo: mix(a.halo, b.halo, t),
    board: mix(a.board, b.board, t),
    steam: mix(a.steam, b.steam, t),
  };
}

/** The knight leaps onto the board between "Kahveni al" and "Oyuna katıl". */
export const knightHop = (story: number) =>
  story > 0 && story < 1 ? Math.sin(Math.PI * smoothstep(0, 1, story)) * 1.3 : 0;

/** The token spins once per scrolled chapter on its way to the front. */
export const tokenSpin = (story: number) => Math.max(0, story - 1) * Math.PI * 2;

/** 0 before the burst, then 0 to 1 as the reward chapter settles. */
export const confettiProgress = (story: number) => clamp((story - 1.35) / 0.65);

/**
 * Maps the chapter list's position to the story: chapter i plays while its block
 * crosses `anchor` (a viewport y), and the opening shot holds until the list arrives.
 */
export const storyFromScroll = (listTop: number, listHeight: number, anchor: number) => {
  const passed = (anchor - listTop) / Math.max(1, listHeight);
  return clamp(passed * 3 - 0.5, STORY_START, STORY_END);
};

export const chapterFromStory = (story: number) => clamp(Math.round(story), 0, 2);

/** Deterministic pseudo-random sequence so the confetti burst looks the same every time. */
export const seeded = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
};
