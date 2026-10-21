const { createGetGameStateHandler } = require('./getGameStateHandler');
const {
  createQuizPrivateState,
  createQuizPublicState,
  startQuizState,
} = require('../../../gameEngine/quizEngine');
const {
  createAimPrivateState,
  createAimPublicState,
  startAimState,
} = require('../../../gameEngine/aimEngine');
const { QUIZ_GAME_TYPE } = require('../../../../shared/gameRegistry');

const createMockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.payload = null;
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((payload) => {
    res.payload = payload;
    return res;
  });
  return res;
};

const buildMemoryGame = (nowMs) => {
  const privateState = createQuizPrivateState();
  return {
    id: 5,
    hostName: 'Alice',
    guestName: 'Bob',
    gameType: QUIZ_GAME_TYPE,
    points: 10,
    table: 'MASA01',
    status: 'active',
    winner: null,
    gameState: {
      engine: startQuizState({
        state: createQuizPublicState({
          hostName: 'Alice',
          guestName: 'Bob',
          totalRounds: privateState.questions.length,
        }),
        privateState,
        hostName: 'Alice',
        guestName: 'Bob',
        nowMs,
      }),
    },
    gamePrivateState: privateState,
    createdAt: new Date().toISOString(),
  };
};

const makeDeps = ({ games = [], connected = false, pool = null } = {}) => ({
  pool,
  isDbConnected: jest.fn(async () => connected),
  logger: { error: jest.fn(), warn: jest.fn() },
  buildChessTimeoutResolution: jest.fn(() => null),
  getMemoryGames: () => games,
  emitRealtimeUpdate: jest.fn(),
});

describe('getGameStateHandler – competitive engine', () => {
  it('advances an expired memory round before serializing and hides the key', async () => {
    const game = buildMemoryGame(Date.now() - 15_500);
    const deps = makeDeps({ games: [game] });
    const handler = createGetGameStateHandler(deps);
    const res = createMockRes();

    await handler({ params: { id: '5' }, user: { username: 'Alice' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.gameState.engine.phase).toBe('reveal');
    expect(res.payload.gameState.engine.round.correctIndex).toBeDefined();
    expect(res.payload.gameState.engine.round.picks).toEqual({ host: null, guest: null });
    expect(res.payload.gameState.engine.private).toBeUndefined();
    expect(res.payload.gamePrivateState).toBeUndefined();
    expect(res.payload.game_state).toBeUndefined();
    expect(deps.emitRealtimeUpdate).toHaveBeenCalledWith(
      '5',
      expect.objectContaining({ type: 'game_state_updated', phase: 'reveal' })
    );
  });

  it('persists the advanced public state for a DB game', async () => {
    const memory = buildMemoryGame(Date.now() - 15_500);
    const row = {
      id: memory.id,
      hostName: memory.hostName,
      guestName: memory.guestName,
      gameType: memory.gameType,
      points: memory.points,
      table: memory.table,
      status: memory.status,
      winner: null,
      gameState: memory.gameState,
      gamePrivateState: memory.gamePrivateState,
      createdAt: memory.createdAt,
    };
    const pool = {
      query: jest.fn(async (sql) => {
        if (/UPDATE games/i.test(sql)) return { rows: [{ id: row.id }] };
        return { rows: [row] };
      }),
    };
    const deps = makeDeps({ connected: true, pool });
    const handler = createGetGameStateHandler(deps);
    const res = createMockRes();

    await handler({ params: { id: '5' }, user: { username: 'Bob' } }, res);

    expect(res.statusCode).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE games'),
      expect.arrayContaining(['5', expect.stringContaining('"engine"'), 'active', null])
    );
    expect(res.payload.gameState.engine.phase).toBe('reveal');
    expect(res.payload.gameState.engine.round.correctIndex).toBeDefined();
    expect(res.payload.gamePrivateState).toBeUndefined();
  });

  it('advances an expired aim round and exposes only the trajectory/shots', async () => {
    const nowMs = Date.now();
    const privateState = createAimPrivateState();
    const state = startAimState({
      state: createAimPublicState({
        hostName: 'Alice',
        guestName: 'Bob',
        totalRounds: privateState.rounds.length,
      }),
      privateState,
      hostName: 'Alice',
      guestName: 'Bob',
      nowMs: nowMs - 8_500,
    });
    const game = {
      id: 6,
      hostName: 'Alice',
      guestName: 'Bob',
      gameType: 'Nişancı Düellosu',
      points: 10,
      table: 'MASA01',
      status: 'active',
      winner: null,
      gameState: { engine: state },
      gamePrivateState: privateState,
      createdAt: new Date().toISOString(),
    };
    const deps = makeDeps({ games: [game] });
    const handler = createGetGameStateHandler(deps);
    const res = createMockRes();

    await handler({ params: { id: '6' }, user: { username: 'Alice' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload.gameState.engine.kind).toBe('aim');
    expect(res.payload.gameState.engine.phase).toBe('reveal');
    expect(res.payload.gameState.engine.round.shots).toEqual({ host: null, guest: null });
    expect(res.payload.gameState.engine.round.trajectory).toMatchObject({
      start: expect.any(Number),
      direction: expect.any(Number),
    });
    expect(res.payload.gamePrivateState).toBeUndefined();
  });

  it('refuses a non-participant before serializing', async () => {
    const game = buildMemoryGame(Date.now());
    const handler = createGetGameStateHandler(makeDeps({ games: [game] }));
    const res = createMockRes();

    await handler({ params: { id: '5' }, user: { username: 'Mallory' } }, res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.gameState).toBeUndefined();
  });
});
