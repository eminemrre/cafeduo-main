const {
  AIM_RHYTHM_MAX_AMPLITUDE,
  AIM_SPEED,
  AIM_ZONES,
  createRhythm,
  pointsAt,
  pointsFromDistance,
  positionAt,
  sanitizeRhythm,
} = require('./aimTrajectory');

const RHYTHM = [
  { amplitude: 0.3, periodMs: 1200, phase: 0.5 },
  { amplitude: 0.2, periodMs: 500, phase: 2 },
];

// Integrates the speed numerically, independent of the closed form under test.
const travelledNumerically = (speed, rhythm, elapsedMs) => {
  const steps = 20_000;
  const dt = elapsedMs / steps;
  let distance = 0;
  for (let i = 0; i < steps; i += 1) {
    const t = (i + 0.5) * dt;
    const multiplier = rhythm.reduce(
      (sum, wave) =>
        sum + wave.amplitude * Math.sin((2 * Math.PI * t) / wave.periodMs + wave.phase),
      1
    );
    distance += speed * multiplier * dt;
  }
  return distance;
};

describe('shared aim trajectory', () => {
  it('starts at the seeded position and moves in the seeded direction', () => {
    expect(positionAt({ start: 50, direction: 1, speed: 0.1 }, 0)).toBe(50);
    expect(positionAt({ start: 50, direction: 1, speed: 0.1 }, 100)).toBe(60);
    expect(positionAt({ start: 50, direction: -1, speed: 0.1 }, 100)).toBe(40);
  });

  it('bounces off both edges instead of wrapping', () => {
    expect(positionAt({ start: 90, direction: 1, speed: 0.1 }, 100)).toBe(100);
    expect(positionAt({ start: 90, direction: 1, speed: 0.1 }, 200)).toBe(90);
    expect(positionAt({ start: 10, direction: -1, speed: 0.1 }, 100)).toBe(0);
    expect(positionAt({ start: 10, direction: -1, speed: 0.1 }, 200)).toBe(10);
    expect(positionAt({ start: 50, direction: 1, speed: 0.1 }, 1600)).toBe(10);
  });

  it('clamps malformed starts and elapsed values', () => {
    expect(positionAt({ start: -20, direction: 1 }, 0)).toBe(0);
    expect(positionAt({ start: 220, direction: 1 }, 0)).toBe(100);
    expect(positionAt({ start: 50, direction: 1, speed: 0 }, -50)).toBe(50);
    expect(positionAt({ start: 50, direction: 1 }, 0)).toBe(50);
  });

  it('uses the narrowed hit tiers', () => {
    expect(AIM_ZONES).toEqual([
      { maxDistance: 2.5, points: 3 },
      { maxDistance: 6, points: 2 },
      { maxDistance: 12, points: 1 },
    ]);
    expect(pointsFromDistance(0)).toBe(3);
    expect(pointsFromDistance(2.5)).toBe(3);
    expect(pointsFromDistance(2.51)).toBe(2);
    expect(pointsFromDistance(-6)).toBe(2);
    expect(pointsFromDistance(6.01)).toBe(1);
    expect(pointsFromDistance(12)).toBe(1);
    expect(pointsFromDistance(12.01)).toBe(0);
    // A shot the old tiers paid 3 or 2 for now pays less.
    expect(pointsFromDistance(4)).toBe(2);
    expect(pointsFromDistance(10)).toBe(1);
    expect(pointsFromDistance(18)).toBe(0);
  });

  it('scores a centered start as a perfect hit at the default speed', () => {
    expect(pointsAt({ start: 50, direction: 1, speed: AIM_SPEED }, 0)).toBe(3);
    expect(pointsAt({ start: 70, direction: 1, speed: 0.1 }, 0)).toBe(0);
  });

  describe('rhythm', () => {
    it('keeps a trajectory without a rhythm at constant speed (matches already in flight)', () => {
      const plain = { start: 20, direction: 1, speed: AIM_SPEED };
      expect(positionAt(plain, 460)).toBeCloseTo(60, 10);
      expect(positionAt({ ...plain, rhythm: [] }, 460)).toBeCloseTo(60, 10);
    });

    it('follows the integral of the varying speed, not a constant speed', () => {
      for (const elapsed of [137, 400, 911, 2500, 7999]) {
        const distance = travelledNumerically(AIM_SPEED, RHYTHM, elapsed);
        const expected = (() => {
          const raw = 0 + distance;
          const phase = ((raw % 200) + 200) % 200;
          return phase <= 100 ? phase : 200 - phase;
        })();
        expect(
          positionAt({ start: 0, direction: 1, speed: AIM_SPEED, rhythm: RHYTHM }, elapsed)
        ).toBeCloseTo(expected, 3);
      }
      const constant = positionAt({ start: 0, direction: 1, speed: AIM_SPEED }, 400);
      const varying = positionAt({ start: 0, direction: 1, speed: AIM_SPEED, rhythm: RHYTHM }, 400);
      expect(Math.abs(constant - varying)).toBeGreaterThan(1);
    });

    it('never stops or reverses between the walls', () => {
      const trajectory = { start: 0, direction: 1, speed: 0.01, rhythm: RHYTHM };
      let previous = positionAt(trajectory, 0);
      for (let t = 5; t < 8000; t += 5) {
        const current = positionAt(trajectory, t);
        expect(current).toBeGreaterThan(previous);
        previous = current;
      }
    });

    it('ignores a malformed or too strong rhythm instead of trusting it', () => {
      expect(sanitizeRhythm(null)).toEqual([]);
      expect(sanitizeRhythm([{ amplitude: 'x', periodMs: 500, phase: 0 }])).toEqual([]);
      expect(sanitizeRhythm([{ amplitude: 0.3, periodMs: 0, phase: 0 }])).toEqual([]);
      expect(
        sanitizeRhythm([
          { amplitude: 0.5, periodMs: 900, phase: 0 },
          { amplitude: 0.5, periodMs: 400, phase: 0 },
        ])
      ).toEqual([]);
      expect(sanitizeRhythm(RHYTHM)).toEqual(RHYTHM);
    });

    it('seeds a bounded two-wave rhythm from integer randomness', () => {
      const draws = [];
      const randomInt = (max) => {
        draws.push(max);
        return max - 1;
      };
      const rhythm = createRhythm(randomInt);
      expect(rhythm).toHaveLength(2);
      const amplitude = rhythm.reduce((sum, wave) => sum + wave.amplitude, 0);
      expect(amplitude).toBeLessThanOrEqual(AIM_RHYTHM_MAX_AMPLITUDE);
      expect(sanitizeRhythm(rhythm)).toEqual(rhythm);
      expect(draws.every((max) => Number.isInteger(max) && max > 0)).toBe(true);

      const low = createRhythm(() => 0);
      expect(sanitizeRhythm(low)).toEqual(low);
    });
  });
});
