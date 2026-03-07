export const CANVAS_W = 800;
export const CANVAS_H = 400;
export const TANK_H = 28;
export const SPEED_MULT = 0.14;
export const MAX_HP = 3;
export const TERRAIN_SEGMENTS = 40;
export const HIT_RADIUS = 40;

export type TankShooter = 'player' | 'opponent';

export interface TankProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  firedBy: TankShooter;
}

export interface TankPositions {
  px: number;
  ox: number;
}

export interface ResolveGroundImpactInput {
  projectile: Pick<TankProjectile, 'x' | 'y' | 'firedBy'>;
  playerTankX: number;
  playerTankY: number;
  opponentTankX: number;
  opponentTankY: number;
  playerHp: number;
  opponentHp: number;
}

export interface ResolveGroundImpactResult {
  shooterIsPlayer: boolean;
  isHit: boolean;
  targetX: number;
  targetY: number;
  distance: number;
  nextPlayerHp: number;
  nextOpponentHp: number;
}

export interface ResolveNextTurnInput {
  currentTurn: number;
  explicitTurn?: unknown;
  explicitWind?: unknown;
  isBot: boolean;
  gameSeed: number;
  randomFn?: () => number;
}

export const clampWind = (value: number): number =>
  Math.max(-2.5, Math.min(2.5, Number(value.toFixed(1))));

export const parseFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const normalizeNameKey = (value: unknown): string => String(value || '').trim().toLowerCase();

export const createSeededRng = (seed: number) => {
  let s = Math.abs(seed) || 1;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

export const computeGameSeed = (gameId: string | number | null | undefined): number => {
  if (!gameId) return 0;
  const str = String(gameId);
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = ((hash << 5) - hash + str.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
};

export const generateTerrain = (seed?: number): number[] => {
  const rng = seed !== undefined ? createSeededRng(seed) : Math.random;
  const points: number[] = [];
  const base = CANVAS_H * 0.65;
  const o1 = 2.0 + rng() * 1.0;
  const o2 = 0.8 + rng() * 0.8;
  const o3 = 3.5 + rng() * 2.0;
  const p1 = rng() * 3;
  const p2 = rng() * 3;

  for (let index = 0; index <= TERRAIN_SEGMENTS; index += 1) {
    const x = index / TERRAIN_SEGMENTS;
    const hill1 = Math.sin(x * Math.PI * o1 + p1) * 35;
    const hill2 = Math.sin(x * Math.PI * o2 + 1.2) * 25;
    const hill3 = Math.sin(x * Math.PI * o3 + p2) * 10;
    points.push(base + hill1 + hill2 + hill3);
  }

  return points;
};

export const terrainYAt = (terrain: number[], xNorm: number): number => {
  const idx = xNorm * TERRAIN_SEGMENTS;
  const lo = Math.max(0, Math.min(TERRAIN_SEGMENTS, Math.floor(idx)));
  const hi = Math.min(TERRAIN_SEGMENTS, lo + 1);
  const t = idx - lo;
  return terrain[lo] * (1 - t) + terrain[hi] * t;
};

export const createTankPositions = (gameSeed: number): TankPositions => {
  const posRng = createSeededRng(gameSeed + 9999);
  return {
    px: 0.08 + posRng() * 0.15,
    ox: 0.77 + posRng() * 0.15,
  };
};

export const getPlayerScoreFromOpponentHp = (opponentHp: number): number =>
  Math.max(0, MAX_HP - opponentHp);

export const buildProjectile = ({
  angle,
  power,
  startX,
  startY,
  firedBy,
}: {
  angle: number;
  power: number;
  startX: number;
  startY: number;
  firedBy: TankShooter;
}): TankProjectile => {
  const angleRad = (firedBy === 'player' ? angle : 180 - angle) * (Math.PI / 180);
  const speed = power * SPEED_MULT;
  return {
    x: startX,
    y: startY,
    vx: Math.cos(angleRad) * speed,
    vy: -Math.sin(angleRad) * speed,
    firedBy,
  };
};

export const deterministicWindForTurn = (gameSeed: number, turn: number): number => {
  const normalizedTurn = Math.max(0, Math.floor(turn));
  const rng = createSeededRng(gameSeed + 7001 + normalizedTurn * 97);
  return clampWind(rng() * 5 - 2.5);
};

export const resolveNextTurnState = ({
  currentTurn,
  explicitTurn,
  explicitWind,
  isBot,
  gameSeed,
  randomFn = Math.random,
}: ResolveNextTurnInput) => {
  const parsedTurn = parseFiniteNumber(explicitTurn);
  const nextTurn = parsedTurn !== null ? Math.max(0, Math.floor(parsedTurn)) : currentTurn + 1;
  const parsedWind = parseFiniteNumber(explicitWind);
  const nextWind = parsedWind !== null
    ? clampWind(parsedWind)
    : isBot
      ? clampWind(randomFn() * 5 - 2.5)
      : deterministicWindForTurn(gameSeed, nextTurn);

  return { nextTurn, nextWind };
};

export const resolveGroundImpact = ({
  projectile,
  playerTankX,
  playerTankY,
  opponentTankX,
  opponentTankY,
  playerHp,
  opponentHp,
}: ResolveGroundImpactInput): ResolveGroundImpactResult => {
  const shooterIsPlayer = projectile.firedBy === 'player';
  const targetX = shooterIsPlayer ? opponentTankX * CANVAS_W : playerTankX * CANVAS_W;
  const targetY = shooterIsPlayer ? opponentTankY : playerTankY;
  const distance = Math.sqrt((projectile.x - targetX) ** 2 + (projectile.y - targetY) ** 2);
  const isHit = distance <= HIT_RADIUS;

  return {
    shooterIsPlayer,
    isHit,
    targetX,
    targetY,
    distance,
    nextPlayerHp: shooterIsPlayer || !isHit ? playerHp : Math.max(0, playerHp - 1),
    nextOpponentHp: !shooterIsPlayer || !isHit ? opponentHp : Math.max(0, opponentHp - 1),
  };
};

export const getTankBarrelStart = (xNorm: number, yPos: number) => ({
  x: xNorm * CANVAS_W,
  y: yPos - TANK_H + 4,
});
