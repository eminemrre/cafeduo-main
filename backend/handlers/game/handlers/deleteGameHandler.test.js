const { createDeleteGameHandler } = require('./deleteGameHandler');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    payload: null,
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((payload) => {
      res.payload = payload;
      return res;
    }),
  };
  return res;
};

const makeDeps = ({ games = [], dbConnected = false } = {}) => {
  const memoryGames = [...games];
  return {
    pool: { query: jest.fn(async () => ({ rows: [] })) },
    isDbConnected: jest.fn(async () => dbConnected),
    logger: { warn: jest.fn(), error: jest.fn() },
    lobbyCacheService: { onGameDeleted: jest.fn(async () => {}) },
    getMemoryGames: () => memoryGames,
    setMemoryGames: (next) => {
      memoryGames.length = 0;
      memoryGames.push(...next);
    },
    emitLobbyUpdate: jest.fn(),
    _memoryGamesRef: memoryGames,
  };
};

const game = (overrides = {}) => ({
  id: 10,
  hostName: 'Alice',
  guestName: 'Bob',
  gameType: 'Bilgi Yarışı',
  points: 10,
  table: 'MASA01',
  status: 'active',
  gameState: { engine: { version: 2, phase: 'open' } },
  ...overrides,
});

describe('deleteGameHandler – competitive engine boundary', () => {
  it('does not let a participant delete an active competitive game', async () => {
    const deps = makeDeps({ games: [game()] });
    const handler = createDeleteGameHandler(deps);
    const res = createMockRes();

    await handler({ params: { id: '10' }, user: { username: 'Alice', role: 'user' } }, res);

    expect(res.statusCode).toBe(404);
    expect(deps._memoryGamesRef).toHaveLength(1);
  });

  it('does not let an admin delete an active competitive game either', async () => {
    const deps = makeDeps({ games: [game()] });
    const handler = createDeleteGameHandler(deps);
    const res = createMockRes();

    await handler(
      { params: { id: '10' }, user: { username: 'root', role: 'admin', isAdmin: true } },
      res
    );

    expect(res.statusCode).toBe(404);
    expect(deps._memoryGamesRef).toHaveLength(1);
  });

  it('allows deleting a waiting competitive game', async () => {
    const deps = makeDeps({ games: [game({ status: 'waiting' })] });
    const handler = createDeleteGameHandler(deps);
    const res = createMockRes();

    await handler({ params: { id: '10' }, user: { username: 'Alice', role: 'user' } }, res);

    expect(res.statusCode).toBe(200);
    expect(deps._memoryGamesRef).toHaveLength(0);
  });

  it('allows deleting a finished competitive game only after settlement', async () => {
    const unsettled = game({
      status: 'finished',
      gameState: { engine: { version: 2, phase: 'finished', result: {} } },
    });
    const settled = game({
      id: 11,
      status: 'finished',
      gameState: { engine: { version: 2, phase: 'finished', result: { settled: true } } },
    });
    const deps = makeDeps({ games: [unsettled, settled] });
    const handler = createDeleteGameHandler(deps);

    const first = createMockRes();
    await handler({ params: { id: '10' }, user: { username: 'Alice', role: 'user' } }, first);
    expect(first.statusCode).toBe(404);
    expect(deps._memoryGamesRef).toHaveLength(2);

    const second = createMockRes();
    await handler({ params: { id: '11' }, user: { username: 'Alice', role: 'user' } }, second);
    expect(second.statusCode).toBe(200);
    expect(deps._memoryGamesRef).toHaveLength(1);
  });
});
