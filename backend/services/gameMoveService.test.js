/**
 * gameMoveService unit tests
 *
 * DB yolu:
 *   - 404 (oyun yok)
 *   - 403 (katılımcı değil)
 *   - chess: non-chess türe hamle → 400
 *   - chess: status active değil → 409
 *   - chess: renk yok → 403
 *   - chess: safeMove null → 400
 *   - chess: timeout → settlement + finished + emit
 *   - chess: sıra değil → 409
 *   - chess: yasadışı hamle → 400
 *   - chess: checkmate → settlement + finished + emit
 *   - chess: draw (gameOver, winner yok) → settlement + finished
 *   - chess: geçersiz durum geçişi sonrası → 409
 *   - liveSubmission: inactive → 409
 *   - liveSubmission: aktör yok → 403
 *   - liveSubmission: mode uyumsuz → 400
 *   - liveSubmission: idempotent aynı key → erken dönüş
 *   - liveSubmission: başarılı kayıt + emit
 *   - scoreSubmission: inactive → 409
 *   - scoreSubmission: aktör yok → 403
 *   - scoreSubmission: idempotent → zaten test edildi
 *   - scoreSubmission: yeni kayıt + emit
 *   - gameState güncelleme: active → merge + emit
 *   - gameState güncelleme: inactive → 409
 *   - legacy move (host): update + emit
 *   - legacy move (guest): update + emit
 *   - legacy move: yetkisiz → 403
 *   - legacy move: inactive → 409
 *   - catch bloğu → 500 + rollback
 *
 * Memory yolu:
 *   - 404
 *   - 403
 *   - chess: non-chess → 400
 *   - chess: inactive → 409
 *   - chess: renk yok → 403
 *   - chess: safeMove null → 400
 *   - chess: timeout → settlement + finished + emit
 *   - chess: sıra değil → 409
 *   - chess: yasadışı hamle → 400
 *   - chess: checkmate → settlement + finished
 *   - chess: draw → settlement + finished
 *   - chess: geçersiz geçiş → 409
 *   - liveSubmission: inactive → 409
 *   - liveSubmission: aktör yok → 403
 *   - liveSubmission: mode uyumsuz → 400
 *   - liveSubmission: idempotent
 *   - liveSubmission: başarılı
 *   - scoreSubmission: inactive → 409
 *   - scoreSubmission: aktör yok → 403
 *   - scoreSubmission: idempotent
 *   - scoreSubmission: yeni kayıt
 *   - gameState: inactive → 409
 *   - gameState: başarılı merge
 *   - legacy move: host
 *   - legacy move: guest
 *   - legacy move: yetkisiz → 403
 *   - legacy move: inactive → 409
 */

const { createGameMoveService } = require('./gameMoveService');
const { sendTransitionError } = require('../handlers/game/utils/errorHelpers');

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

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

const normalizeParticipantName = (name, game) => {
  const actor = String(name || '')
    .trim()
    .toLowerCase();
  const host = String(game.host_name || game.hostName || '')
    .trim()
    .toLowerCase();
  const guest = String(game.guest_name || game.guestName || '')
    .trim()
    .toLowerCase();
  if (actor && actor === host) return game.host_name || game.hostName;
  if (actor && actor === guest) return game.guest_name || game.guestName;
  return null;
};

const getGameParticipants = (game) =>
  [game.host_name || game.hostName, game.guest_name || game.guestName].filter(Boolean);

/** DB client mock'u — sadece gerekli SQL'leri tanır */
const makeClient = ({ gameRow = null, failOn = null } = {}) => {
  const client = {
    _committed: false,
    _rolledBack: false,
    query: jest.fn(async (sql, _params) => {
      const s = String(sql || '');
      if (failOn && s.includes(failOn)) throw new Error('mock DB error');
      if (s.includes('FROM games') && s.includes('FOR UPDATE')) {
        return { rows: gameRow ? [gameRow] : [] };
      }
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  client.query.mockImplementation(async (sql, _params) => {
    const s = String(sql || '');
    if (failOn && s.includes(failOn)) throw new Error('mock DB error');
    if (s.includes('BEGIN')) {
      return { rows: [] };
    }
    if (s.includes('COMMIT')) {
      client._committed = true;
      return { rows: [] };
    }
    if (s.includes('ROLLBACK')) {
      client._rolledBack = true;
      return { rows: [] };
    }
    if (s.includes('FROM games') && s.includes('FOR UPDATE')) {
      return { rows: gameRow ? [gameRow] : [] };
    }
    return { rows: [] };
  });
  return client;
};

// Temiz fabrika
const buildService = ({ gameRow = null, failOn = null, overrides = {} } = {}) => {
  const client = makeClient({ gameRow, failOn });
  const pool = { connect: jest.fn(async () => client) };
  const emit = jest.fn();
  const deps = {
    ...baseDepsDerived_raw(),
    pool,
    emitRealtimeUpdate: emit,
    ...overrides,
  };
  const service = createGameMoveService(deps);
  return { service, client, pool, emit, deps };
};

const baseDepsDerived_raw = () => ({
  pool: null, // buildService tarafından doldurulur
  isDbConnected: jest.fn(async () => true),
  logger: { error: jest.fn() },
  normalizeParticipantName,
  isAdminActor: () => false,
  isChessGameType: (t) => String(t || '').trim() === 'Retro Satranç',
  resolveParticipantColor: (participant, game) => {
    if (participant === (game.host_name || game.hostName)) return 'w';
    if (participant === (game.guest_name || game.guestName)) return 'b';
    return null;
  },
  sanitizeChessMovePayload: (m) => m,
  createInitialChessState: () => ({ fen: '', clock: {} }),
  buildChessStateFromEngine: (chess, _prev, appliedMove) => ({
    fen: chess.fen(),
    turn: chess.turn(),
    isGameOver: chess.isGameOver(),
    result: chess.isCheckmate() ? 'checkmate' : chess.isDraw() ? 'draw' : null,
    moveHistory: appliedMove ? [{ san: appliedMove.san }] : [],
  }),
  assertGameStatusTransition: jest.fn(() => ({ ok: true })),
  assertRequiredGameStatus: jest.fn(({ currentStatus, requiredStatus }) => ({
    ok: currentStatus === requiredStatus,
    code: 'invalid_status_transition',
    message: 'invalid',
    from: currentStatus,
    to: requiredStatus,
  })),
  sendTransitionError,
  sanitizeLiveSubmission: (p) => p,
  getGameParticipants,
  pickWinnerFromResults: jest.fn(() => null),
  sanitizeScoreSubmission: (p) => p,
  getMemoryGames: jest.fn(() => []),
  emitRealtimeUpdate: jest.fn(),
  applyDbSettlement: jest.fn(async () => ({ transferredPoints: 50 })),
  applyMemorySettlement: jest.fn(() => ({ transferredPoints: 50 })),
  getMemoryUsers: jest.fn(() => []),
});

const CHESS_GAME = {
  id: 1,
  host_name: 'u1',
  guest_name: 'u2',
  game_type: 'Retro Satranç',
  status: 'active',
  game_state: {},
};
const SCORE_GAME = {
  id: 9,
  host_name: 'u1',
  guest_name: 'u2',
  game_type: 'Nişancı Düellosu',
  status: 'active',
  game_state: {},
};
const chessReq = (body = {}) => ({
  params: { id: '1' },
  user: { username: 'u1' },
  body,
});
const scoreReq = (body = {}) => ({
  params: { id: '9' },
  user: { username: 'u1' },
  body,
});

// ===========================================================================
// DB YOLU
// ===========================================================================

describe('gameMoveService – DB yolu', () => {
  // -------------------------------------------------------------------------
  // Temel guard'lar
  // -------------------------------------------------------------------------

  it('oyun bulunamadığında 404 döner ve ROLLBACK yapar', async () => {
    const { service, client } = buildService({ gameRow: null });
    const res = createMockRes();
    await service.makeMove({ params: { id: '99' }, user: { username: 'u1' }, body: {} }, res);
    expect(res.statusCode).toBe(404);
    expect(client._rolledBack).toBe(true);
  });

  it('katılımcı olmayan kullanıcıya 403 döner', async () => {
    const { service } = buildService({ gameRow: CHESS_GAME });
    const res = createMockRes();
    await service.makeMove({ params: { id: '1' }, user: { username: 'yabanci' }, body: {} }, res);
    expect(res.statusCode).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Chess hamlesi – guard'lar
  // -------------------------------------------------------------------------

  it('chess: non-chess oyun türüne chessMove gönderilince 400 döner', async () => {
    const { service } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(scoreReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/satranç hamlesi kabul etmiyor/);
  });

  it('chess: oyun active değilse 409 döner', async () => {
    const { service } = buildService({ gameRow: { ...CHESS_GAME, status: 'finished' } });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(409);
    expect(res.payload).toMatchObject({
      code: 'invalid_status_transition',
      error: 'invalid',
      details: { fromStatus: 'finished', toStatus: 'active' },
    });
  });

  it('chess: resolvedColor geçersizse 403 döner', async () => {
    const { service } = buildService({
      gameRow: CHESS_GAME,
      overrides: { resolveParticipantColor: () => null },
    });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(403);
    expect(res.payload?.error).toMatch(/hamle yetkin yok/);
  });

  it('chess: sanitizeChessMovePayload null döndürünce 400 döner', async () => {
    const { service } = buildService({
      gameRow: CHESS_GAME,
      overrides: { sanitizeChessMovePayload: () => null },
    });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/Geçersiz satranç hamlesi/);
  });

  // -------------------------------------------------------------------------
  // Chess – timeout
  // -------------------------------------------------------------------------

  it('chess: beyaz süre bitince timeout → siyah kazanır, settlement uygulanır, finished emit edilir', async () => {
    const { service, emit, deps } = buildService({
      gameRow: {
        ...CHESS_GAME,
        game_state: {
          chess: {
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            clock: {
              baseMs: 180000,
              incrementMs: 2000,
              whiteMs: 0,
              blackMs: 180000,
              lastTickAt: new Date(Date.now() - 200000).toISOString(),
            },
          },
        },
      },
    });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.timeout).toBe(true);
    expect(res.payload?.status).toBe('finished');
    expect(res.payload?.winner).toBe('u2'); // beyaz zamanında, siyah kazanır
    expect(deps.applyDbSettlement).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ type: 'chess_state', status: 'finished' })
    );
  });

  // -------------------------------------------------------------------------
  // Chess – sıra değil
  // -------------------------------------------------------------------------

  it('chess: sıra başka oyuncudaysa 409 döner', async () => {
    // Başlangıç FEN'de beyaz oynuyor; u2 (siyah) hamle yapmaya çalışıyor
    const { service } = buildService({ gameRow: CHESS_GAME });
    const res = createMockRes();
    await service.makeMove(
      {
        params: { id: '1' },
        user: { username: 'u2' },
        body: { chessMove: { from: 'e7', to: 'e5' } },
      },
      res
    );
    expect(res.statusCode).toBe(409);
    expect(res.payload?.error).toMatch(/Sıra sende değil/);
    expect(res.payload?.code).toBe('NOT_YOUR_TURN');
  });

  // -------------------------------------------------------------------------
  // Chess – yasadışı hamle
  // -------------------------------------------------------------------------

  it('chess: yasadışı hamle → 400 döner', async () => {
    const { service } = buildService({ gameRow: CHESS_GAME });
    const res = createMockRes();
    // h1→h8 yasadışı
    await service.makeMove(chessReq({ chessMove: { from: 'h1', to: 'h8' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/Yasadışı hamle/);
    expect(res.payload?.code).toBe('ILLEGAL_MOVE');
  });

  // -------------------------------------------------------------------------
  // Chess – geçerli hamle → active kalır, emit
  // -------------------------------------------------------------------------

  it('chess: geçerli hamle kabul edilir, active durumda kalır, emit çağrılır', async () => {
    const { service, emit } = buildService({ gameRow: CHESS_GAME });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.status).toBe('active');
    expect(emit).toHaveBeenCalledWith('1', expect.objectContaining({ type: 'chess_state' }));
  });

  // -------------------------------------------------------------------------
  // Chess – assertGameStatusTransition başarısız
  // -------------------------------------------------------------------------

  it('chess: assertGameStatusTransition başarısız → 409 döner', async () => {
    const { service } = buildService({
      gameRow: CHESS_GAME,
      overrides: {
        assertGameStatusTransition: jest.fn(() => ({
          ok: false,
          code: 'bad_transition',
          message: 'bad',
        })),
      },
    });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // liveSubmission
  // -------------------------------------------------------------------------

  it('liveSubmission: oyun active değilse 409', async () => {
    const { service } = buildService({ gameRow: { ...SCORE_GAME, status: 'finished' } });
    const res = createMockRes();
    await service.makeMove(scoreReq({ liveSubmission: { submissionKey: 'k1' } }), res);
    expect(res.statusCode).toBe(409);
  });

  it('liveSubmission: aktör katılımcı değilse 403', async () => {
    const { service } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(
      {
        params: { id: '9' },
        user: { username: 'yabanci' },
        body: { liveSubmission: { submissionKey: 'k1' } },
      },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('liveSubmission: mode oyun türüyle eşleşmiyorsa 400', async () => {
    const { service } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(
      scoreReq({ liveSubmission: { submissionKey: 'k1', mode: 'Yanlış Tür' } }),
      res
    );
    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/oyun türü eşleşmiyor/);
  });

  it('liveSubmission: aynı submissionKey ile tekrar gönderilince idempotent döner', async () => {
    const { service } = buildService({
      gameRow: {
        ...SCORE_GAME,
        game_state: {
          live: {
            submissions: {
              u1: { submissionKey: 'live-key-1', done: false },
            },
          },
        },
      },
    });
    const res = createMockRes();
    await service.makeMove(scoreReq({ liveSubmission: { submissionKey: 'live-key-1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.idempotent).toBe(true);
  });

  it('liveSubmission: yeni submission kaydedilir, emit çağrılır', async () => {
    const { service, emit } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(scoreReq({ liveSubmission: { submissionKey: 'live-new-1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(emit).toHaveBeenCalledWith('9', expect.objectContaining({ type: 'live_submission' }));
  });

  // -------------------------------------------------------------------------
  // scoreSubmission
  // -------------------------------------------------------------------------

  it('scoreSubmission: oyun active değilse 409', async () => {
    const { service } = buildService({ gameRow: { ...SCORE_GAME, status: 'finished' } });
    const res = createMockRes();
    await service.makeMove(scoreReq({ scoreSubmission: { score: 5, submissionKey: 'k1' } }), res);
    expect(res.statusCode).toBe(409);
  });

  it('scoreSubmission: aktör katılımcı değilse 403', async () => {
    const { service } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(
      {
        params: { id: '9' },
        user: { username: 'yabanci' },
        body: { scoreSubmission: { score: 5, submissionKey: 'k1' } },
      },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('scoreSubmission: yeni skor kaydedilir, emit çağrılır', async () => {
    const { service, emit } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(
      scoreReq({ scoreSubmission: { score: 7, submissionKey: 'new-score-1' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(emit).toHaveBeenCalledWith('9', expect.objectContaining({ type: 'score_submission' }));
  });

  it('scoreSubmission: idempotent aynı key tekrar gönderilince UPDATE yapılmaz', async () => {
    const { service, client } = buildService({
      gameRow: {
        ...SCORE_GAME,
        game_state: {
          results: {
            u1: { score: 5, submissionKey: 'dup-key' },
          },
        },
      },
    });
    const res = createMockRes();
    await service.makeMove(
      scoreReq({ scoreSubmission: { score: 5, submissionKey: 'dup-key' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload?.idempotent).toBe(true);
    const updateCalled = client.query.mock.calls.some(
      ([sql]) =>
        String(sql || '').includes('UPDATE games') && String(sql || '').includes('SET game_state')
    );
    expect(updateCalled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // gameState güncelleme
  // -------------------------------------------------------------------------

  it('gameState: active oyunda merge edilir, emit çağrılır', async () => {
    const { service, emit } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(scoreReq({ gameState: { customKey: 'val' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.success).toBe(true);
    expect(emit).toHaveBeenCalledWith('9', expect.objectContaining({ type: 'game_state' }));
  });

  it('gameState: inactive oyunda 409 döner', async () => {
    const { service } = buildService({ gameRow: { ...SCORE_GAME, status: 'finished' } });
    const res = createMockRes();
    await service.makeMove(scoreReq({ gameState: { x: 1 } }), res);
    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Legacy move
  // -------------------------------------------------------------------------

  it('legacy move: host kendi hamlesi için player1_move update eder', async () => {
    const { service, client } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(scoreReq({ move: 'A', player: 'host' }), res);
    expect(res.statusCode).toBe(200);
    const updateCall = client.query.mock.calls.find(([sql]) =>
      String(sql || '').includes('player1_move')
    );
    expect(updateCall).toBeDefined();
  });

  it('legacy move: guest kendi hamlesi için player2_move update eder', async () => {
    const { service, client } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(
      { params: { id: '9' }, user: { username: 'u2' }, body: { move: 'B', player: 'guest' } },
      res
    );
    expect(res.statusCode).toBe(200);
    const updateCall = client.query.mock.calls.find(([sql]) =>
      String(sql || '').includes('player2_move')
    );
    expect(updateCall).toBeDefined();
  });

  it('legacy move: katılımcı olmayan 403 alır', async () => {
    const { service } = buildService({ gameRow: SCORE_GAME });
    const res = createMockRes();
    await service.makeMove(
      { params: { id: '9' }, user: { username: 'yabanci' }, body: { move: 'X' } },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('legacy move: inactive oyunda 409 döner', async () => {
    const { service } = buildService({ gameRow: { ...SCORE_GAME, status: 'finished' } });
    const res = createMockRes();
    await service.makeMove(scoreReq({ move: 'X' }), res);
    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // Catch / 500
  // -------------------------------------------------------------------------

  it('DB hatası olunca 500 döner ve ROLLBACK yapılır', async () => {
    const { service, client, deps } = buildService({ gameRow: CHESS_GAME });
    // BEGIN'den sonra hata fırlat
    const original = client.query.getMockImplementation();
    let callCount = 0;
    client.query.mockImplementation(async (sql, params) => {
      const s = String(sql || '');
      callCount++;
      if (callCount > 1 && s.includes('FROM games')) throw new Error('DB down');
      return original(sql, params);
    });
    const res = createMockRes();
    await service.makeMove(chessReq({ chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(500);
    expect(deps.logger.error).toHaveBeenCalled();
  });
});

// ===========================================================================
// MEMORY YOLU
// ===========================================================================

describe('gameMoveService – memory yolu', () => {
  const memGame = () => ({
    id: '10',
    hostName: 'u1',
    guestName: 'u2',
    gameType: 'Retro Satranç',
    status: 'active',
    gameState: {},
    player1Move: null,
    player2Move: null,
  });

  const memScoreGame = () => ({
    id: '11',
    hostName: 'u1',
    guestName: 'u2',
    gameType: 'Nişancı Düellosu',
    status: 'active',
    gameState: {},
  });

  const buildMemService = ({ game = null, overrides = {} } = {}) => {
    const games = game ? [game] : [];
    const emit = jest.fn();
    const deps = {
      ...baseDepsDerived_raw(),
      pool: null,
      isDbConnected: jest.fn(async () => false),
      getMemoryGames: jest.fn(() => games),
      emitRealtimeUpdate: emit,
      ...overrides,
    };
    const service = createGameMoveService(deps);
    return { service, emit, deps, games };
  };

  const memReq = (id, username, body) => ({
    params: { id: String(id) },
    user: { username },
    body,
  });

  // -------------------------------------------------------------------------
  // Guard'lar
  // -------------------------------------------------------------------------

  it('oyun bulunamadığında 404 döner', async () => {
    const { service } = buildMemService({ game: null });
    const res = createMockRes();
    await service.makeMove(memReq('99', 'u1', {}), res);
    expect(res.statusCode).toBe(404);
  });

  it('katılımcı olmayan 403 alır', async () => {
    const { service } = buildMemService({ game: memGame() });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'yabanci', {}), res);
    expect(res.statusCode).toBe(403);
  });

  // -------------------------------------------------------------------------
  // Chess
  // -------------------------------------------------------------------------

  it('chess: non-chess türe chessMove → 400', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g, overrides: { isChessGameType: () => false } });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('chess: inactive oyunda 409', async () => {
    const g = { ...memGame(), status: 'finished' };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(409);
  });

  it('chess: renk çözülemiyorsa 403', async () => {
    const g = memGame();
    const { service } = buildMemService({
      game: g,
      overrides: { resolveParticipantColor: () => null },
    });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(403);
  });

  it('chess: safeMove null → 400', async () => {
    const g = memGame();
    const { service } = buildMemService({
      game: g,
      overrides: { sanitizeChessMovePayload: () => null },
    });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('chess: timeout → beyaz zamanında, siyah kazanır, settlement uygulanır', async () => {
    const g = {
      ...memGame(),
      gameState: {
        chess: {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          clock: {
            baseMs: 180000,
            incrementMs: 2000,
            whiteMs: 0,
            blackMs: 180000,
            lastTickAt: new Date(Date.now() - 200000).toISOString(),
          },
        },
      },
    };
    const { service, emit, deps } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.payload?.timeout).toBe(true);
    expect(res.payload?.winner).toBe('u2');
    expect(deps.applyMemorySettlement).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(
      '10',
      expect.objectContaining({ type: 'chess_state', status: 'finished' })
    );
  });

  it('chess: sıra başka oyuncudaysa 409', async () => {
    const g = memGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    // u2 siyah ama beyazın sırası
    await service.makeMove(memReq('10', 'u2', { chessMove: { from: 'e7', to: 'e5' } }), res);
    expect(res.statusCode).toBe(409);
    expect(res.payload?.error).toMatch(/Sıra sende değil/);
    expect(res.payload?.code).toBe('NOT_YOUR_TURN');
  });

  it('chess: yasadışı hamle → 400', async () => {
    const g = memGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'h1', to: 'h8' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('chess: geçerli hamle kabul edilir, emit çağrılır', async () => {
    const g = memGame();
    const { service, emit } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.status).toBe('active');
    expect(emit).toHaveBeenCalledWith('10', expect.objectContaining({ type: 'chess_state' }));
  });

  it('chess: assertGameStatusTransition başarısız → 409', async () => {
    const g = memGame();
    const { service } = buildMemService({
      game: g,
      overrides: {
        assertGameStatusTransition: jest.fn(() => ({ ok: false, code: 'bad', message: 'bad' })),
      },
    });
    const res = createMockRes();
    await service.makeMove(memReq('10', 'u1', { chessMove: { from: 'e2', to: 'e4' } }), res);
    expect(res.statusCode).toBe(409);
  });

  // -------------------------------------------------------------------------
  // liveSubmission – memory
  // -------------------------------------------------------------------------

  it('liveSubmission: inactive → 409', async () => {
    const g = { ...memScoreGame(), status: 'finished' };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u1', { liveSubmission: { submissionKey: 'k1' } }), res);
    expect(res.statusCode).toBe(409);
  });

  it('liveSubmission: aktör yok → 403', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'yabanci', { liveSubmission: { submissionKey: 'k1' } }),
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('liveSubmission: mode uyumsuz → 400', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'u1', { liveSubmission: { submissionKey: 'k1', mode: 'Yanlış' } }),
      res
    );
    expect(res.statusCode).toBe(400);
  });

  it('liveSubmission: idempotent aynı key', async () => {
    const g = {
      ...memScoreGame(),
      gameState: {
        live: {
          submissions: { u1: { submissionKey: 'live-mem-1', done: false } },
        },
      },
    };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'u1', { liveSubmission: { submissionKey: 'live-mem-1' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload?.idempotent).toBe(true);
  });

  it('liveSubmission: yeni submission kaydedilir, emit çağrılır', async () => {
    const g = memScoreGame();
    const { service, emit } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'u1', { liveSubmission: { submissionKey: 'live-new-mem' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(emit).toHaveBeenCalledWith('11', expect.objectContaining({ type: 'live_submission' }));
  });

  // -------------------------------------------------------------------------
  // scoreSubmission – memory
  // -------------------------------------------------------------------------

  it('scoreSubmission: inactive → 409', async () => {
    const g = { ...memScoreGame(), status: 'finished' };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'u1', { scoreSubmission: { score: 5, submissionKey: 'k1' } }),
      res
    );
    expect(res.statusCode).toBe(409);
  });

  it('scoreSubmission: aktör yok → 403', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'yabanci', { scoreSubmission: { score: 5, submissionKey: 'k1' } }),
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it('scoreSubmission: idempotent aynı key → tekrar kaydedilmez', async () => {
    const g = {
      ...memScoreGame(),
      gameState: {
        results: { u1: { score: 3, submissionKey: 'mem-score-key' } },
      },
    };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'u1', { scoreSubmission: { score: 3, submissionKey: 'mem-score-key' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.payload?.idempotent).toBe(true);
  });

  it('scoreSubmission: yeni skor kaydedilir, emit çağrılır', async () => {
    const g = memScoreGame();
    const { service, emit } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(
      memReq('11', 'u1', { scoreSubmission: { score: 7, submissionKey: 'mem-new-score' } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(emit).toHaveBeenCalledWith('11', expect.objectContaining({ type: 'score_submission' }));
  });

  // -------------------------------------------------------------------------
  // gameState – memory
  // -------------------------------------------------------------------------

  it('gameState: inactive → 409', async () => {
    const g = { ...memScoreGame(), status: 'finished' };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u1', { gameState: { x: 1 } }), res);
    expect(res.statusCode).toBe(409);
  });

  it('gameState: merge edilir, emit çağrılır', async () => {
    const g = memScoreGame();
    const { service, emit } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u1', { gameState: { testKey: 'abc' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.gameState?.testKey).toBe('abc');
    expect(emit).toHaveBeenCalledWith('11', expect.objectContaining({ type: 'game_state' }));
  });

  // -------------------------------------------------------------------------
  // Legacy move – memory
  // -------------------------------------------------------------------------

  it('legacy move: host player1Move kaydedilir', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u1', { move: 'hamle-X' }), res);
    expect(res.statusCode).toBe(200);
    expect(g.player1Move).toBe('hamle-X');
  });

  it('legacy move: guest player2Move kaydedilir', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u2', { move: 'hamle-Y' }), res);
    expect(res.statusCode).toBe(200);
    expect(g.player2Move).toBe('hamle-Y');
  });

  it('legacy move: yetkisiz kullanıcı → 403', async () => {
    const g = memScoreGame();
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'yabanci', { move: 'X' }), res);
    expect(res.statusCode).toBe(403);
  });

  it('legacy move: inactive → 409', async () => {
    const g = { ...memScoreGame(), status: 'finished' };
    const { service } = buildMemService({ game: g });
    const res = createMockRes();
    await service.makeMove(memReq('11', 'u1', { move: 'X' }), res);
    expect(res.statusCode).toBe(409);
  });
});
