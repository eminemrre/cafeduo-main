/**
 * Shared aim-duel trajectory math.
 *
 * The server owns the official reticle position: it is computed from the
 * round start time and the trajectory it seeded. The client uses the same
 * function to draw the reticle, but the score always comes from the position
 * at the server receive time.
 *
 * The gauge moves in [0, 100] and bounces off both ends. `speed` is gauge
 * units per millisecond; the default pair is the desktop 4 / 46 ms tuning and
 * is the single competitive difficulty on every device.
 */

const AIM_GAUGE_STEP = 4;
const AIM_TICK_MS = 46;
const AIM_SPEED = AIM_GAUGE_STEP / AIM_TICK_MS;
const AIM_ROUND_MS = 8000;
const AIM_REVEAL_MS = 750;
const AIM_ROUND_COUNT = 5;
const AIM_MAX_SCORE = 15;
const AIM_START_MIN = 15;
const AIM_START_MAX = 85;
const AIM_MIN_POSITION = 0;
const AIM_MAX_POSITION = 100;
const AIM_CENTER = 50;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const positionAt = (trajectory, elapsedMs) => {
  const start = clamp(Number(trajectory?.start) || 0, AIM_MIN_POSITION, AIM_MAX_POSITION);
  const direction = Number(trajectory?.direction) === -1 ? -1 : 1;
  const speed =
    Number.isFinite(Number(trajectory?.speed)) && Number(trajectory.speed) > 0
      ? Number(trajectory.speed)
      : AIM_SPEED;
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const raw = start + direction * speed * elapsed;
  const phase = ((raw % 200) + 200) % 200;
  return phase <= 100 ? phase : 200 - phase;
};

const pointsFromDistance = (distance) => {
  const value = Math.abs(Number(distance) || 0);
  if (value <= 4) return 3;
  if (value <= 10) return 2;
  if (value <= 18) return 1;
  return 0;
};

const pointsAt = (trajectory, elapsedMs) =>
  pointsFromDistance(Math.abs(AIM_CENTER - positionAt(trajectory, elapsedMs)));

module.exports = {
  AIM_CENTER,
  AIM_GAUGE_STEP,
  AIM_MAX_POSITION,
  AIM_MAX_SCORE,
  AIM_MIN_POSITION,
  AIM_REVEAL_MS,
  AIM_ROUND_COUNT,
  AIM_ROUND_MS,
  AIM_SPEED,
  AIM_START_MAX,
  AIM_START_MIN,
  AIM_TICK_MS,
  clamp,
  pointsAt,
  pointsFromDistance,
  positionAt,
};
