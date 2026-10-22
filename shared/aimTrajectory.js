/**
 * Shared aim-duel trajectory math.
 *
 * The server owns the official reticle position: it is computed from the
 * round start time and the trajectory it seeded. The client uses the same
 * function to draw the reticle, but the score always comes from the position
 * at the server receive time.
 *
 * The gauge moves in [0, 100] and bounces off both ends. `speed` is the mean
 * speed in gauge units per millisecond; the default pair is the desktop
 * 4 / 46 ms tuning and is the single competitive difficulty on every device.
 *
 * A seeded `rhythm` (two sine waves) speeds the reticle up and slows it down
 * around that mean, so a round cannot be timed from memory. The multiplier
 * `1 + Σ a·sin(2πt/p + φ)` stays at or above 0.4, so the reticle never stops,
 * and its integral has a closed form, so the server and the client compute the
 * same position without stepping. A trajectory without a rhythm keeps the
 * constant speed of matches created before the rhythm existed.
 */

/**
 * The math is written once here and loaded by both runtimes:
 *   - the CommonJS backend uses `require` and gets `module.exports`;
 *   - Vite imports the file in the browser, where `module` does not exist, so
 *     the same API is published under a private global for `lib/aimTrajectory`.
 * This keeps one implementation without shipping a second, drifting formula.
 */
(function publishAimTrajectory(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__CAFEDUO_AIM_TRAJECTORY__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createAimTrajectory() {
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
  // Narrowed 2026-10-21 (user decision): 3 points within 2.5 units of the
  // centre, 2 within 6, 1 within 12.
  const AIM_ZONES = Object.freeze([
    Object.freeze({ maxDistance: 2.5, points: 3 }),
    Object.freeze({ maxDistance: 6, points: 2 }),
    Object.freeze({ maxDistance: 12, points: 1 }),
  ]);
  const AIM_RHYTHM_MAX_AMPLITUDE = 0.6;
  const AIM_RHYTHM_MAX_WAVES = 2;
  const AIM_RHYTHM_MIN_PERIOD_MS = 200;
  const AIM_RHYTHM_MAX_PERIOD_MS = 4000;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  /** Returns the rhythm waves when every value is in range, otherwise none. */
  const sanitizeRhythm = (rhythm) => {
    if (!Array.isArray(rhythm) || rhythm.length > AIM_RHYTHM_MAX_WAVES) return [];
    const waves = [];
    let amplitudeSum = 0;
    for (const wave of rhythm) {
      const amplitude = Number(wave?.amplitude);
      const periodMs = Number(wave?.periodMs);
      const phase = Number(wave?.phase);
      if (
        !Number.isFinite(amplitude) ||
        !Number.isFinite(periodMs) ||
        !Number.isFinite(phase) ||
        amplitude < 0 ||
        periodMs < AIM_RHYTHM_MIN_PERIOD_MS ||
        periodMs > AIM_RHYTHM_MAX_PERIOD_MS
      ) {
        return [];
      }
      amplitudeSum += amplitude;
      waves.push({ amplitude, periodMs, phase });
    }
    return amplitudeSum <= AIM_RHYTHM_MAX_AMPLITUDE + 1e-9 ? waves : [];
  };

  /**
   * Seeds a two-wave rhythm from an integer source (`randomInt(max)` returns
   * 0..max-1), so the server can use crypto randomness.
   */
  const createRhythm = (randomInt) => {
    const pick = (min, max, steps) => min + ((max - min) * randomInt(steps + 1)) / steps;
    const phase = () => (2 * Math.PI * randomInt(3600)) / 3600;
    return [
      { amplitude: pick(0.2, 0.35, 15), periodMs: Math.round(pick(900, 1600, 70)), phase: phase() },
      { amplitude: pick(0.1, 0.25, 15), periodMs: Math.round(pick(380, 700, 32)), phase: phase() },
    ];
  };

  /** Distance travelled after `elapsed` ms: ∫ speed·(1 + Σ a·sin(ωt + φ)) dt. */
  const travelled = (speed, waves, elapsed) => {
    let distance = elapsed;
    for (const wave of waves) {
      const omega = (2 * Math.PI) / wave.periodMs;
      distance +=
        (wave.amplitude / omega) * (Math.cos(wave.phase) - Math.cos(omega * elapsed + wave.phase));
    }
    return speed * distance;
  };

  const positionAt = (trajectory, elapsedMs) => {
    const start = clamp(Number(trajectory?.start) || 0, AIM_MIN_POSITION, AIM_MAX_POSITION);
    const direction = Number(trajectory?.direction) === -1 ? -1 : 1;
    const speed =
      Number.isFinite(Number(trajectory?.speed)) && Number(trajectory.speed) > 0
        ? Number(trajectory.speed)
        : AIM_SPEED;
    const elapsed = Math.max(0, Number(elapsedMs) || 0);
    const raw = start + direction * travelled(speed, sanitizeRhythm(trajectory?.rhythm), elapsed);
    const phase = ((raw % 200) + 200) % 200;
    return phase <= 100 ? phase : 200 - phase;
  };

  const pointsFromDistance = (distance) => {
    const value = Math.abs(Number(distance) || 0);
    for (const zone of AIM_ZONES) {
      if (value <= zone.maxDistance) return zone.points;
    }
    return 0;
  };

  const pointsAt = (trajectory, elapsedMs) =>
    pointsFromDistance(Math.abs(AIM_CENTER - positionAt(trajectory, elapsedMs)));

  return {
    AIM_CENTER,
    AIM_GAUGE_STEP,
    AIM_MAX_POSITION,
    AIM_MAX_SCORE,
    AIM_MIN_POSITION,
    AIM_REVEAL_MS,
    AIM_RHYTHM_MAX_AMPLITUDE,
    AIM_ROUND_COUNT,
    AIM_ROUND_MS,
    AIM_SPEED,
    AIM_START_MAX,
    AIM_START_MIN,
    AIM_TICK_MS,
    AIM_ZONES,
    clamp,
    createRhythm,
    pointsAt,
    pointsFromDistance,
    positionAt,
    sanitizeRhythm,
  };
});
