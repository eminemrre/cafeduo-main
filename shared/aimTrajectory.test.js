const { AIM_SPEED, pointsAt, pointsFromDistance, positionAt } = require('./aimTrajectory');

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

  it('uses the documented hit tiers', () => {
    expect(pointsFromDistance(0)).toBe(3);
    expect(pointsFromDistance(4)).toBe(3);
    expect(pointsFromDistance(4.01)).toBe(2);
    expect(pointsFromDistance(10)).toBe(2);
    expect(pointsFromDistance(10.01)).toBe(1);
    expect(pointsFromDistance(18)).toBe(1);
    expect(pointsFromDistance(18.01)).toBe(0);
  });

  it('scores a centered start as a perfect hit at the default speed', () => {
    expect(pointsAt({ start: 50, direction: 1, speed: AIM_SPEED }, 0)).toBe(3);
    expect(pointsAt({ start: 70, direction: 1, speed: 0.1 }, 0)).toBe(0);
  });
});
