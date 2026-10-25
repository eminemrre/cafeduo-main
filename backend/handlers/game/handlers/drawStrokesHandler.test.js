const { createDrawStrokesHandler } = require('./drawStrokesHandler');

const createMockRes = () => {
  const res = { statusCode: 200, payload: null };
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

const OPS = [{ t: 'line', id: 1, c: 0, w: 1, p: [[1, 2]] }];
const memoryGame = (phase = 'drawing', gameType = 'Çiz Bil') => ({
  id: 77,
  hostName: 'Ada',
  guestName: 'Bora',
  gameType,
  gameState: { engine: { kind: 'draw', phase, round: { id: 'r2', drawer: 'guest' } } },
  gamePrivateState: { rounds: [{ choices: [{ word: 'kedi' }] }] },
});

const setup = ({ game = memoryGame(), db = false, row = null } = {}) => {
  const store = { list: jest.fn(async () => OPS) };
  const pool = { query: jest.fn(async () => ({ rows: row ? [row] : [] })) };
  const handler = createDrawStrokesHandler({
    pool,
    isDbConnected: jest.fn(async () => db),
    getMemoryGames: () => (game ? [game] : []),
    strokeStore: store,
    logger: { error: jest.fn() },
  });
  const call = async (username, id = '77', user = {}) => {
    const res = createMockRes();
    await handler({ params: { id }, user: { username, ...user } }, res);
    return res;
  };
  return { call, store, pool };
};

describe('GET /api/games/:id/strokes', () => {
  it('returns the current round strokes to either player', async () => {
    const { call, store } = setup();
    for (const name of ['ada', 'BORA']) {
      const res = await call(name);
      expect(res.statusCode).toBe(200);
      expect(res.payload).toEqual({ roundId: 'r2', ops: OPS });
    }
    expect(store.list).toHaveBeenCalledWith('77', 'r2');
  });

  it('refuses outsiders, other games and unknown games', async () => {
    expect((await setup().call('Cem')).statusCode).toBe(403);
    expect((await setup({ game: memoryGame('drawing', 'Adam Asmaca') }).call('Ada')).statusCode).toBe(400);
    expect((await setup({ game: null }).call('Ada')).statusCode).toBe(404);
  });

  it('has nothing to replay while the drawer is still choosing', async () => {
    const { call, store } = setup({ game: memoryGame('choosing') });
    expect((await call('Ada')).payload).toEqual({ roundId: 'r2', ops: [] });
    expect(store.list).not.toHaveBeenCalled();
  });

  it('reads the public engine only from the database, never the private state', async () => {
    const { call, pool } = setup({
      db: true,
      row: { hostName: 'Ada', guestName: 'Bora', gameType: 'Çiz Bil', engine: memoryGame().gameState.engine },
    });
    const res = await call('Ada');
    expect(res.payload).toEqual({ roundId: 'r2', ops: OPS });
    const [sql] = pool.query.mock.calls[0];
    expect(sql).not.toMatch(/private|SELECT \*/i);
    expect(sql).toMatch(/LIMIT 1/);
  });

  it('answers a generic 500 when the store fails', async () => {
    const { call, store } = setup();
    store.list.mockRejectedValueOnce(new Error('redis exploded at 10.0.0.1'));
    const res = await call('Ada');
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.payload)).not.toMatch(/redis|10\.0/);
  });
});
