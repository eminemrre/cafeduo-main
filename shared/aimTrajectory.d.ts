export interface AimTrajectory {
  start: number;
  direction: 1 | -1;
  speed?: number;
  rhythm?: AimRhythmWave[];
}

export interface AimRhythmWave {
  amplitude: number;
  periodMs: number;
  phase: number;
}

export interface AimZone {
  maxDistance: number;
  points: number;
}

export const AIM_CENTER: number;
export const AIM_GAUGE_STEP: number;
export const AIM_MAX_POSITION: number;
export const AIM_MAX_SCORE: number;
export const AIM_MIN_POSITION: number;
export const AIM_REVEAL_MS: number;
export const AIM_RHYTHM_MAX_AMPLITUDE: number;
export const AIM_ROUND_COUNT: number;
export const AIM_ROUND_MS: number;
export const AIM_SPEED: number;
export const AIM_START_MAX: number;
export const AIM_START_MIN: number;
export const AIM_TICK_MS: number;
export const AIM_ZONES: readonly AimZone[];

export function clamp(value: number, min: number, max: number): number;
export function createRhythm(randomInt: (max: number) => number): AimRhythmWave[];
export function pointsAt(trajectory: AimTrajectory, elapsedMs: number): number;
export function pointsFromDistance(distance: number): number;
export function positionAt(trajectory: AimTrajectory, elapsedMs: number): number;
export function sanitizeRhythm(rhythm: unknown): AimRhythmWave[];
