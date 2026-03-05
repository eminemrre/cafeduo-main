/** @jest-environment node */

const { createGameRepository } = require('./gameRepository');

describe('gameRepository', () => {
  const supportedGameTypes = new Set(['reflex_hunt', 'retro_chess', 'knowledge_quiz']);

  const setup = () => {
    const pool = { query: jest.fn() };
    const client = { query: jest.fn() };
    const repo = createGameRepository({ pool, supportedGameTypes });
    return { repo, pool, client };
  };

  it('lists waiting games by table with supported game types filter', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValue({ rows: [{ id: 12, table: 'MASA06', status: 'waiting' }] });

    const rows = await repo.listWaitingGamesByTable({ tableCode: 'MASA06' });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND table_code = $2');
    expect(sql).toContain('LIMIT 100');
    expect(params).toEqual([['reflex_hunt', 'retro_chess', 'knowledge_quiz'], 'MASA06']);
    expect(rows).toEqual([{ id: 12, table: 'MASA06', status: 'waiting' }]);
  });

  it('lists waiting games by cafe with EXISTS user cafe guard', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValue({ rows: [{ id: 31 }] });

    const rows = await repo.listWaitingGamesByCafe({ cafeId: 4 });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND EXISTS');
    expect(sql).toContain('LIMIT 100');
    expect(params).toEqual([['reflex_hunt', 'retro_chess', 'knowledge_quiz'], 4]);
    expect(rows).toEqual([{ id: 31 }]);
  });

  it('returns latest active game by username or null', async () => {
    const { repo, pool } = setup();
    pool.query.mockResolvedValueOnce({ rows: [{ id: 50, status: 'active' }] });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const found = await repo.findLatestActiveGameByUsername('emin');
    const missing = await repo.findLatestActiveGameByUsername('ghost');

    expect(found).toEqual({ id: 50, status: 'active' });
    expect(missing).toBeNull();
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("status = 'active'"),
      ['emin', ['reflex_hunt', 'retro_chess', 'knowledge_quiz']]
    );
  });

  it('inserts waiting game and serializes json state', async () => {
    const { repo, client } = setup();
    client.query.mockResolvedValue({
      rows: [{ id: 77, gameType: 'retro_chess', status: 'waiting' }],
    });

    const row = await repo.insertWaitingGame(client, {
      hostName: 'emin',
      gameType: 'retro_chess',
      points: 100,
      table: 'MASA08',
      gameState: { chess: { fen: 'startpos' } },
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("VALUES ($1, $2, $3, $4, 'waiting', $5::jsonb)"),
      ['emin', 'retro_chess', 100, 'MASA08', JSON.stringify({ chess: { fen: 'startpos' } })]
    );
    expect(row).toEqual({ id: 77, gameType: 'retro_chess', status: 'waiting' });
  });

  it('activates waiting game with guest and returns updated row', async () => {
    const { repo, client } = setup();
    client.query.mockResolvedValue({ rows: [{ id: 14, guestName: 'rakip', status: 'active' }] });

    const updated = await repo.activateGameWithGuest(client, {
      gameId: 14,
      guestName: 'rakip',
      gameState: { turn: 'w' },
    });

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = $2\n          AND status = 'waiting'"),
      ['rakip', 14, JSON.stringify({ turn: 'w' })]
    );
    expect(updated).toEqual({ id: 14, guestName: 'rakip', status: 'active' });
  });

  it('persists finish and state update payloads as jsonb', async () => {
    const { repo, client } = setup();

    await repo.finishGame(client, {
      gameId: 9,
      winner: 'host',
      gameState: { winner: 'host', reason: 'resign' },
    });
    await repo.updateGameState(client, {
      gameId: 9,
      gameState: { turn: 'b', moveHistory: ['e4'] },
    });

    expect(client.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SET status = 'finished'"),
      ['host', JSON.stringify({ winner: 'host', reason: 'resign' }), 9]
    );
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('SET game_state = $1::jsonb'),
      [JSON.stringify({ turn: 'b', moveHistory: ['e4'] }), 9]
    );
  });
});
