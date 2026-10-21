/**
 * Browser-side access to the one trajectory implementation in
 * `shared/aimTrajectory.js`. The shared file publishes its API on a private
 * global because it is CommonJS for the backend and cannot be a native ESM
 * export for Vite at the same time.
 */
import '../shared/aimTrajectory';

interface AimTrajectoryApi {
  positionAt: (
    trajectory: { start: number; direction: 1 | -1; speed?: number },
    elapsedMs: number
  ) => number;
  AIM_GAUGE_STEP: number;
  AIM_TICK_MS: number;
}

const api = (globalThis as typeof globalThis & { __CAFEDUO_AIM_TRAJECTORY__?: AimTrajectoryApi })
  .__CAFEDUO_AIM_TRAJECTORY__;

if (!api) {
  throw new Error('Aim trajectory module failed to initialize.');
}

export const positionAt = api.positionAt;
export const AIM_GAUGE_STEP = api.AIM_GAUGE_STEP;
export const AIM_TICK_MS = api.AIM_TICK_MS;
