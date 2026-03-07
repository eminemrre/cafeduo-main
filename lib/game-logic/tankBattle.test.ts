import {
  CANVAS_W,
  HIT_RADIUS,
  MAX_HP,
  buildProjectile,
  clampWind,
  computeGameSeed,
  createSeededRng,
  createTankPositions,
  deterministicWindForTurn,
  generateTerrain,
  getPlayerScoreFromOpponentHp,
  getTankBarrelStart,
  normalizeNameKey,
  parseFiniteNumber,
  resolveGroundImpact,
  resolveNextTurnState,
  terrainYAt,
} from './tankBattle';

describe('tankBattle game logic', () => {
  test('computeGameSeed is deterministic', () => {
    expect(computeGameSeed('abc-123')).toBe(computeGameSeed('abc-123'));
    expect(computeGameSeed(null)).toBe(0);
  });

  test('createSeededRng produces deterministic sequence', () => {
    const left = createSeededRng(42);
    const right = createSeededRng(42);
    expect([left(), left(), left()]).toEqual([right(), right(), right()]);
  });

  test('generateTerrain and terrainYAt are deterministic with seed', () => {
    const terrain = generateTerrain(10);
    expect(terrain).toHaveLength(41);
    expect(terrain).toEqual(generateTerrain(10));
    expect(terrainYAt(terrain, 0.25)).toBeCloseTo(terrainYAt(terrain, 0.25), 6);
  });

  test('createTankPositions stays within expected bands', () => {
    const positions = createTankPositions(99);
    expect(positions.px).toBeGreaterThanOrEqual(0.08);
    expect(positions.px).toBeLessThanOrEqual(0.23);
    expect(positions.ox).toBeGreaterThanOrEqual(0.77);
    expect(positions.ox).toBeLessThanOrEqual(0.92);
  });

  test('numeric helpers normalize values safely', () => {
    expect(clampWind(10)).toBe(2.5);
    expect(clampWind(-10)).toBe(-2.5);
    expect(parseFiniteNumber('12.5')).toBe(12.5);
    expect(parseFiniteNumber('x')).toBeNull();
    expect(normalizeNameKey('  Emin  ')).toBe('emin');
    expect(getPlayerScoreFromOpponentHp(MAX_HP - 2)).toBe(2);
  });

  test('buildProjectile uses mirrored angle for opponent shots', () => {
    const playerShot = buildProjectile({ angle: 45, power: 60, startX: 10, startY: 20, firedBy: 'player' });
    const opponentShot = buildProjectile({ angle: 45, power: 60, startX: 10, startY: 20, firedBy: 'opponent' });
    expect(playerShot.x).toBe(10);
    expect(playerShot.y).toBe(20);
    expect(playerShot.vx).toBeGreaterThan(0);
    expect(opponentShot.vx).toBeLessThan(0);
  });

  test('deterministicWindForTurn and resolveNextTurnState stay reproducible', () => {
    const wind = deterministicWindForTurn(12, 4);
    expect(wind).toBe(deterministicWindForTurn(12, 4));

    expect(resolveNextTurnState({ currentTurn: 3, explicitTurn: 8, explicitWind: 1.8, isBot: false, gameSeed: 12 })).toEqual({
      nextTurn: 8,
      nextWind: 1.8,
    });

    const botTurn = resolveNextTurnState({
      currentTurn: 3,
      isBot: true,
      gameSeed: 12,
      randomFn: () => 1,
    });
    expect(botTurn.nextTurn).toBe(4);
    expect(botTurn.nextWind).toBe(2.5);
  });

  test('resolveGroundImpact handles hit and miss for both sides', () => {
    const hit = resolveGroundImpact({
      projectile: { x: 0.8 * CANVAS_W, y: 200, firedBy: 'player' },
      playerTankX: 0.15,
      playerTankY: 220,
      opponentTankX: 0.8,
      opponentTankY: 200,
      playerHp: MAX_HP,
      opponentHp: MAX_HP,
    });
    expect(hit.isHit).toBe(true);
    expect(hit.nextOpponentHp).toBe(MAX_HP - 1);
    expect(hit.nextPlayerHp).toBe(MAX_HP);
    expect(hit.distance).toBeLessThanOrEqual(HIT_RADIUS);

    const miss = resolveGroundImpact({
      projectile: { x: 0.7 * CANVAS_W, y: 50, firedBy: 'opponent' },
      playerTankX: 0.15,
      playerTankY: 220,
      opponentTankX: 0.8,
      opponentTankY: 200,
      playerHp: MAX_HP,
      opponentHp: MAX_HP,
    });
    expect(miss.shooterIsPlayer).toBe(false);
    expect(miss.isHit).toBe(false);
    expect(miss.nextPlayerHp).toBe(MAX_HP);
    expect(miss.nextOpponentHp).toBe(MAX_HP);
  });

  test('getTankBarrelStart returns deterministic barrel anchor', () => {
    expect(getTankBarrelStart(0.5, 250)).toEqual({ x: 400, y: 226 });
  });
});
