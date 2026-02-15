const { createGameMoveService } = require('./gameMoveService');

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

describe('gameMoveService (db mode)', () => {
  it('accepts chess move for db row with game_type and updates realtime state', async () => {
    const client = {
      query: jest.fn(async (query) => {
        const sql = String(query || '');
        if (sql.includes('FROM games') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: 1,
                host_name: 'u1',
                guest_name: 'u2',
                game_type: 'Retro Satranç',
                status: 'active',
                game_state: {},
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };

    const pool = {
      connect: jest.fn(async () => client),
    };

    const emitRealtimeUpdate = jest.fn();

    const service = createGameMoveService({
      pool,
      isDbConnected: jest.fn(async () => true),
      logger: { error: jest.fn() },
      normalizeParticipantName: (name, game) => {
        const actor = String(name || '').trim().toLowerCase();
        const host = String(game.host_name || '').trim().toLowerCase();
        const guest = String(game.guest_name || '').trim().toLowerCase();
        if (actor === host) return game.host_name;
        if (actor === guest) return game.guest_name;
        return null;
      },
      isAdminActor: () => false,
      isChessGameType: (gameType) => String(gameType || '').trim() === 'Retro Satranç',
      resolveParticipantColor: (participant, game) => {
        if (participant === game.host_name) return 'w';
        if (participant === game.guest_name) return 'b';
        return null;
      },
      sanitizeChessMovePayload: (payload) => payload,
      createInitialChessState: () => ({}),
      buildChessStateFromEngine: (chess) => ({
        fen: chess.fen(),
        turn: chess.turn(),
        isGameOver: chess.isGameOver(),
        result: null,
        moveHistory: [],
      }),
      assertGameStatusTransition: () => ({ ok: true }),
      assertRequiredGameStatus: ({ currentStatus, requiredStatus }) => ({
        ok: currentStatus === requiredStatus,
        code: 'invalid_status_transition',
        message: 'invalid',
        from: currentStatus,
        to: requiredStatus,
      }),
      mapTransitionError: () => ({}),
      sanitizeLiveSubmission: (payload) => payload,
      getGameParticipants: (game) => [game.host_name, game.guest_name].filter(Boolean),
      pickWinnerFromResults: () => null,
      sanitizeScoreSubmission: (payload) => payload,
      getMemoryGames: () => [],
      emitRealtimeUpdate,
    });

    const req = {
      params: { id: '1' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: { chessMove: { from: 'e2', to: 'e4' } },
    };
    const res = createMockRes();

    await service.makeMove(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload?.status).toBe('active');
    expect(res.payload?.gameState?.chess?.clock).toEqual(
      expect.objectContaining({
        baseMs: expect.any(Number),
        incrementMs: expect.any(Number),
        whiteMs: expect.any(Number),
        blackMs: expect.any(Number),
      })
    );
    expect(emitRealtimeUpdate).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        type: 'chess_state',
        status: 'active',
      })
    );

    const selectCall = client.query.mock.calls.find(([sql]) =>
      String(sql || '').includes('FROM games') && String(sql || '').includes('FOR UPDATE')
    );
    expect(selectCall).toBeDefined();
    expect(String(selectCall[0])).toContain('game_type');
  });

  it('treats duplicate score submission_key as idempotent success', async () => {
    const client = {
      query: jest.fn(async (query) => {
        const sql = String(query || '');
        if (sql.includes('FROM games') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: 9,
                host_name: 'u1',
                guest_name: 'u2',
                game_type: 'Refleks Avı',
                status: 'active',
                game_state: {
                  results: {
                    u1: { score: 5, roundsWon: 5, durationMs: 1000, submissionKey: 'key-123' },
                  },
                },
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };

    const pool = {
      connect: jest.fn(async () => client),
    };

    const service = createGameMoveService({
      pool,
      isDbConnected: jest.fn(async () => true),
      logger: { error: jest.fn() },
      normalizeParticipantName: (name, game) => {
        const actor = String(name || '').trim().toLowerCase();
        const host = String(game.host_name || '').trim().toLowerCase();
        const guest = String(game.guest_name || '').trim().toLowerCase();
        if (actor === host) return game.host_name;
        if (actor === guest) return game.guest_name;
        return null;
      },
      isAdminActor: () => false,
      isChessGameType: () => false,
      resolveParticipantColor: () => null,
      sanitizeChessMovePayload: () => null,
      createInitialChessState: () => ({}),
      buildChessStateFromEngine: () => ({}),
      assertGameStatusTransition: () => ({ ok: true }),
      assertRequiredGameStatus: ({ currentStatus, requiredStatus }) => ({
        ok: currentStatus === requiredStatus,
        code: 'invalid_status_transition',
        message: 'invalid',
        from: currentStatus,
        to: requiredStatus,
      }),
      mapTransitionError: () => ({}),
      sanitizeLiveSubmission: (payload) => payload,
      getGameParticipants: (game) => [game.host_name, game.guest_name].filter(Boolean),
      pickWinnerFromResults: () => null,
      sanitizeScoreSubmission: (payload) => payload,
      getMemoryGames: () => [],
      emitRealtimeUpdate: jest.fn(),
    });

    const req = {
      params: { id: '9' },
      user: { username: 'u1', role: 'user', isAdmin: false },
      body: {
        scoreSubmission: { username: 'u1', score: 5, roundsWon: 5, durationMs: 1000, submissionKey: 'key-123' },
      },
    };
    const res = createMockRes();

    await service.makeMove(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(
      expect.objectContaining({
        success: true,
        idempotent: true,
      })
    );

    const updateCall = client.query.mock.calls.find(([sql]) =>
      String(sql || '').includes('UPDATE games') && String(sql || '').includes('SET game_state')
    );
    expect(updateCall).toBeUndefined();
  });
});
