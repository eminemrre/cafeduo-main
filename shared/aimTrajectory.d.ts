export interface AimTrajectory {
  start: number;
  direction: 1 | -1;
  speed?: number;
}

export const AIM_CENTER: number;
export const AIM_GAUGE_STEP: number;
export const AIM_MAX_POSITION: number;
export const AIM_MAX_SCORE: number;
export const AIM_MIN_POSITION: number;
export const AIM_REVEAL_MS: number;
export const AIM_ROUND_COUNT: number;
export const AIM_ROUND_MS: number;
export const AIM_SPEED: number;
export const AIM_START_MAX: number;
export const AIM_START_MIN: number;
export const AIM_TICK_MS: number;

export function clamp(value: number, min: number, max: number): number;
export function pointsAt(trajectory: AimTrajectory, elapsedMs: number): number;
export function pointsFromDistance(distance: number): number;
export function positionAt(trajectory: AimTrajectory, elapsedMs: number): number;
