/**
 * Browser-side access to the one trajectory implementation in
 * `shared/aimTrajectory.js`. The shared file publishes its API on a private
 * global because it is CommonJS for the backend and cannot be a native ESM
 * export for Vite at the same time.
 */
import '../shared/aimTrajectory';

export interface AimRhythmWave {
  amplitude: number;
  periodMs: number;
  phase: number;
}

export interface AimTrajectory {
  start: number;
  direction: 1 | -1;
  speed?: number;
  rhythm?: AimRhythmWave[];
}

export interface AimZone {
  maxDistance: number;
  points: number;
}

interface AimTrajectoryApi {
  positionAt: (trajectory: AimTrajectory, elapsedMs: number) => number;
  pointsFromDistance: (distance: number) => number;
  createRhythm: (randomInt: (max: number) => number) => AimRhythmWave[];
  AIM_GAUGE_STEP: number;
  AIM_TICK_MS: number;
  AIM_SPEED: number;
  AIM_CENTER: number;
  AIM_ZONES: readonly AimZone[];
}

const api = (globalThis as typeof globalThis & { __CAFEDUO_AIM_TRAJECTORY__?: AimTrajectoryApi })
  .__CAFEDUO_AIM_TRAJECTORY__;

if (!api) {
  throw new Error('Aim trajectory module failed to initialize.');
}

export const positionAt = api.positionAt;
export const AIM_GAUGE_STEP = api.AIM_GAUGE_STEP;
export const AIM_TICK_MS = api.AIM_TICK_MS;
export const AIM_SPEED = api.AIM_SPEED;
export const AIM_CENTER = api.AIM_CENTER;
export const AIM_ZONES = api.AIM_ZONES;
export const pointsFromDistance = api.pointsFromDistance;
export const createRhythm = api.createRhythm;
