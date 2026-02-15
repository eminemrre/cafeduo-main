const { Chess } = require('chess.js');
const {
  GAME_STATUS,
  assertGameStatusTransition,
  assertRequiredGameStatus,
  normalizeGameStatus,
} = require('../utils/gameStateMachine');
const { createGameMoveService } = require('../services/gameMoveService');

const createGameHandlers = ({
  pool,
  isDbConnected,
  logger,
  supportedGameTypes,
  normalizeGameType,
  normalizeTableCode,
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
  getMemoryGames,
  setMemoryGames,
  getMemoryUsers,
  io,
}) => {
  const isAdminActor = (user) => user?.role === 'admin' || user?.isAdmin === true;
  const CHESS_GAME_TYPE = 'Retro Satranç';
  const CHESS_SQUARE_RE = /^[a-h][1-8]$/;
  const DEFAULT_CHESS_CLOCK = Object.freeze({
    baseMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
    label: '3+2 Blitz',
  });
  const CHESS_CLOCK_LIMITS = Object.freeze({
    minBaseSeconds: 60,
    maxBaseSeconds: 1800,
    minIncrementSeconds: 0,
    maxIncrementSeconds: 30,
  });
  const DRAW_OFFER_ACTIONS = new Set(['offer', 'accept', 'reject', 'cancel']);

  const isChessGameType = (gameType) => String(gameType || '').trim() === CHESS_GAME_TYPE;

  const normalizeChessClockConfig = (rawClock) => {
    if (!rawClock || typeof rawClock !== 'object') {
      return { ...DEFAULT_CHESS_CLOCK };
    }

    const rawBaseSeconds = Number(
      rawClock.baseSeconds !== undefined
        ? rawClock.baseSeconds
        : rawClock.baseMs !== undefined
          ? Number(rawClock.baseMs) / 1000
          : DEFAULT_CHESS_CLOCK.baseMs / 1000
    );
    const rawIncrementSeconds = Number(
      rawClock.incrementSeconds !== undefined
        ? rawClock.incrementSeconds
        : rawClock.incrementMs !== undefined
          ? Number(rawClock.incrementMs) / 1000
          : DEFAULT_CHESS_CLOCK.incrementMs / 1000
    );

    const safeBaseSeconds = Number.isFinite(rawBaseSeconds)
      ? Math.min(CHESS_CLOCK_LIMITS.maxBaseSeconds, Math.max(CHESS_CLOCK_LIMITS.minBaseSeconds, Math.floor(rawBaseSeconds)))
      : DEFAULT_CHESS_CLOCK.baseMs / 1000;
    const safeIncrementSeconds = Number.isFinite(rawIncrementSeconds)
      ? Math.min(
          CHESS_CLOCK_LIMITS.maxIncrementSeconds,
          Math.max(CHESS_CLOCK_LIMITS.minIncrementSeconds, Math.floor(rawIncrementSeconds))
        )
      : DEFAULT_CHESS_CLOCK.incrementMs / 1000;

    return {
      baseMs: safeBaseSeconds * 1000,
      incrementMs: safeIncrementSeconds * 1000,
      label: `${safeBaseSeconds / 60}+${safeIncrementSeconds}`,
    };
  };

  const activateChessClockState = (state) => {
    const source = state && typeof state === 'object' ? state : createInitialChessState();
    const sourceClock = source.clock && typeof source.clock === 'object' ? source.clock : DEFAULT_CHESS_CLOCK;
    const config = normalizeChessClockConfig(sourceClock);
    const nowIso = new Date().toISOString();

    return {
      ...source,
      clock: {
        baseMs: config.baseMs,
        incrementMs: config.incrementMs,
        label: sourceClock.label || config.label,
        whiteMs: Number.isFinite(Number(sourceClock.whiteMs)) ? Number(sourceClock.whiteMs) : config.baseMs,
        blackMs: Number.isFinite(Number(sourceClock.blackMs)) ? Number(sourceClock.blackMs) : config.baseMs,
        lastTickAt: nowIso,
      },
      startedAt: source.startedAt || nowIso,
      updatedAt: nowIso,
    };
  };

  const createInitialChessState = (rawClockConfig) => {
    const chess = new Chess();
    const clockConfig = normalizeChessClockConfig(rawClockConfig);
    return {
      version: 1,
      fen: chess.fen(),
      turn: chess.turn(),
      inCheck: false,
      isGameOver: false,
      result: null,
      moveHistory: [],
      clock: {
        baseMs: clockConfig.baseMs,
        incrementMs: clockConfig.incrementMs,
        label: clockConfig.label,
        whiteMs: clockConfig.baseMs,
        blackMs: clockConfig.baseMs,
        lastTickAt: null,
      },
      startedAt: null,
      updatedAt: new Date().toISOString(),
    };
  };

  const resolveParticipantColor = (participant, game) => {
    const host = String(game?.host_name || game?.hostName || '').trim();
    const guest = String(game?.guest_name || game?.guestName || '').trim();
    if (!participant) return null;
    if (participant.toLowerCase() === host.toLowerCase()) return 'w';
    if (participant.toLowerCase() === guest.toLowerCase()) return 'b';
    return null;
  };

  const sanitizeChessMovePayload = (payload) => {
    const from = String(payload?.from || '').trim().toLowerCase();
    const to = String(payload?.to || '').trim().toLowerCase();
    const promotionRaw = String(payload?.promotion || '').trim().toLowerCase();
    const promotion = ['q', 'r', 'b', 'n'].includes(promotionRaw) ? promotionRaw : undefined;
    if (!CHESS_SQUARE_RE.test(from) || !CHESS_SQUARE_RE.test(to)) {
      return null;
    }
    return { from, to, ...(promotion ? { promotion } : {}) };
  };

  const sanitizeLiveSubmission = (payload) => {
    const safeScore = Math.max(0, Math.floor(Number(payload?.score || 0)));
    const safeRounds = Math.max(0, Math.floor(Number(payload?.roundsWon || safeScore)));
    const safeRound = Math.max(0, Math.floor(Number(payload?.round || 0)));
    const done = Boolean(payload?.done);
    const mode = normalizeGameType(payload?.mode) || null;
    const submissionKeyRaw = String(payload?.submissionKey || payload?.submission_key || '').trim();
    const submissionKey = submissionKeyRaw ? submissionKeyRaw.slice(0, 96) : undefined;
    return {
      mode,
      score: safeScore,
      roundsWon: safeRounds,
      round: safeRound,
      done,
      ...(submissionKey ? { submissionKey } : {}),
      updatedAt: new Date().toISOString(),
    };
  };

  const nextChessResult = (chess) => {
    if (chess.isCheckmate()) return 'checkmate';
    if (chess.isStalemate()) return 'stalemate';
    if (chess.isInsufficientMaterial()) return 'insufficient-material';
    if (chess.isThreefoldRepetition()) return 'threefold-repetition';
    if (chess.isDraw()) return 'draw';
    return null;
  };

  const buildChessStateFromEngine = (chess, previousState, lastMove) => {
    const moveHistory = Array.isArray(previousState?.moveHistory)
      ? previousState.moveHistory.slice(-300)
      : [];
    const entry = lastMove
      ? {
          from: lastMove.from,
          to: lastMove.to,
          san: lastMove.san,
          lan: lastMove.lan,
          color: lastMove.color,
          piece: lastMove.piece,
          captured: lastMove.captured || null,
          promotion: lastMove.promotion || null,
          ts: new Date().toISOString(),
        }
      : null;

    const nextHistory = entry ? [...moveHistory, entry] : moveHistory;
    return {
      version: 1,
      fen: chess.fen(),
      turn: chess.turn(),
      inCheck: chess.inCheck(),
      isGameOver: chess.isGameOver(),
      result: nextChessResult(chess),
      moveHistory: nextHistory,
      lastMove: entry,
      updatedAt: new Date().toISOString(),
    };
  };

  const parseIsoTimestampMs = (value) => {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeRuntimeChessClock = (rawClock) => {
    const source = rawClock && typeof rawClock === 'object' ? rawClock : {};
    const config = normalizeChessClockConfig(source);
    const whiteRaw = Number(source.whiteMs);
    const blackRaw = Number(source.blackMs);
    const parsedTick = parseIsoTimestampMs(source.lastTickAt);

    return {
      baseMs: config.baseMs,
      incrementMs: config.incrementMs,
      label: source.label ? String(source.label).slice(0, 32) : config.label,
      whiteMs: Number.isFinite(whiteRaw) ? Math.max(0, Math.floor(whiteRaw)) : config.baseMs,
      blackMs: Number.isFinite(blackRaw) ? Math.max(0, Math.floor(blackRaw)) : config.baseMs,
      lastTickAt: parsedTick ? new Date(parsedTick).toISOString() : null,
    };
  };

  const buildChessTimeoutResolution = ({
    gameType,
    status,
    hostName,
    guestName,
    gameState,
  }) => {
    if (!isChessGameType(gameType)) return null;
    if (normalizeGameStatus(status) !== GAME_STATUS.ACTIVE) return null;

    const currentState = gameState && typeof gameState === 'object' ? gameState : {};
    const currentChessState =
      currentState.chess && typeof currentState.chess === 'object'
        ? currentState.chess
        : null;
    if (!currentChessState) return null;

    const normalizedClock = normalizeRuntimeChessClock(currentChessState.clock);
    const lastTickAtMs = parseIsoTimestampMs(normalizedClock.lastTickAt);
    if (!lastTickAtMs) return null;

    let chess;
    try {
      chess = new Chess(String(currentChessState.fen || ''));
    } catch {
      chess = new Chess();
    }

    const activeColor = chess.turn() === 'b' ? 'b' : 'w';
    const activeClockKey = activeColor === 'w' ? 'whiteMs' : 'blackMs';
    const elapsedMs = Math.max(0, Date.now() - lastTickAtMs);
    const remainingMs = Math.max(0, Number(normalizedClock[activeClockKey] || 0) - elapsedMs);
    if (remainingMs > 0) return null;

    const host = String(hostName || '').trim();
    const guest = String(guestName || '').trim();
    const timeoutWinner = activeColor === 'w' ? guest : host;
    const nowIso = new Date().toISOString();

    const nextChessState = {
      ...buildChessStateFromEngine(chess, currentChessState, null),
      winner: timeoutWinner || null,
      result: 'timeout',
      isGameOver: true,
      timedOutColor: activeColor,
      clock: {
        ...normalizedClock,
        [activeClockKey]: 0,
        lastTickAt: null,
      },
      updatedAt: nowIso,
    };

    const nextGameState = {
      ...currentState,
      chess: nextChessState,
    };
    if (timeoutWinner) {
      nextGameState.resolvedWinner = timeoutWinner;
    } else if (nextGameState.resolvedWinner) {
      delete nextGameState.resolvedWinner;
    }

    return {
      winner: timeoutWinner || null,
      nextGameState,
      nextChessState,
    };
  };

  const emitRealtimeUpdate = (gameId, payload) => {
    try {
      if (!io || typeof io.to !== 'function') return;
      const room = String(gameId || '').trim();
      if (!room) return;
      io.to(room).emit('game_state_updated', payload);
    } catch (err) {
      logger.warn('Realtime emit failed', err);
    }
  };

  const emitLobbyUpdate = (payload = {}) => {
    try {
      if (!io || typeof io.emit !== 'function') return;
      io.emit('lobby_updated', {
        type: 'lobby_updated',
        ts: Date.now(),
        ...payload,
      });
    } catch (err) {
      logger.warn('Lobby emit failed', err);
    }
  };

  const normalizeParticipantKey = (value) => String(value || '').trim().toLowerCase();

  const normalizeDrawOfferAction = (value) => {
    const action = String(value || 'offer').trim().toLowerCase();
    return DRAW_OFFER_ACTIONS.has(action) ? action : null;
  };

  const normalizeDrawOffer = (rawOffer) => {
    if (!rawOffer || typeof rawOffer !== 'object') return null;
    const statusRaw = String(rawOffer.status || '').trim().toLowerCase();
    const offeredBy = String(rawOffer.offeredBy || '').trim();
    if (!offeredBy) return null;
    const status = ['pending', 'accepted', 'rejected', 'cancelled'].includes(statusRaw)
      ? statusRaw
      : 'pending';

    return {
      status,
      offeredBy,
      createdAt: rawOffer.createdAt ? String(rawOffer.createdAt) : new Date().toISOString(),
      respondedBy: rawOffer.respondedBy ? String(rawOffer.respondedBy) : undefined,
      respondedAt: rawOffer.respondedAt ? String(rawOffer.respondedAt) : undefined,
    };
  };

  const findOpponentName = (actorParticipant, game) => {
    const actorKey = normalizeParticipantKey(actorParticipant);
    if (!actorKey) return null;
    const participants = getGameParticipants(game).filter(Boolean);
    return participants.find((name) => normalizeParticipantKey(name) !== actorKey) || null;
  };

  const applyDbSettlement = async ({
    client,
    game,
    winnerName,
    isDraw,
  }) => {
    const hostName = String(game.host_name || '').trim();
    const guestName = String(game.guest_name || '').trim();
    const participants = [hostName, guestName].filter(Boolean);
    if (participants.length === 0) {
      return { transferredPoints: 0 };
    }

    const uniqueLowerParticipants = Array.from(
      new Set(participants.map((name) => normalizeParticipantKey(name)).filter(Boolean))
    );

    const usersResult = await client.query(
      `
        SELECT id, username, points
        FROM users
        WHERE LOWER(username) = ANY($1::text[])
        FOR UPDATE
      `,
      [uniqueLowerParticipants]
    );

    const byUsername = new Map(
      usersResult.rows.map((row) => [normalizeParticipantKey(row.username), row])
    );

    const canonicalWinner = String(winnerName || '').trim();
    const winnerKey = normalizeParticipantKey(canonicalWinner);
    const stake = Math.max(0, Math.floor(Number(game.points || 0)));

    if (!isDraw && canonicalWinner && participants.length === 2) {
      const loserName = participants.find(
        (name) => normalizeParticipantKey(name) !== winnerKey
      );
      const winnerUser = byUsername.get(winnerKey);
      const loserUser = loserName ? byUsername.get(normalizeParticipantKey(loserName)) : null;

      if (winnerUser) {
        const transferable = loserUser
          ? Math.min(stake, Math.max(0, Math.floor(Number(loserUser.points || 0))))
          : 0;
        await client.query(
          `
            UPDATE users
            SET points = points + $1,
                wins = wins + 1,
                games_played = games_played + 1
            WHERE id = $2
          `,
          [transferable, winnerUser.id]
        );

        if (loserUser) {
          await client.query(
            `
              UPDATE users
              SET points = GREATEST(points - $1, 0),
                  games_played = games_played + 1
              WHERE id = $2
            `,
            [transferable, loserUser.id]
          );
        }

        return { transferredPoints: transferable };
      }
    }

    for (const participantName of participants) {
      const user = byUsername.get(normalizeParticipantKey(participantName));
      if (!user) continue;
      const isWinner =
        !isDraw &&
        canonicalWinner &&
        normalizeParticipantKey(participantName) === winnerKey;
      await client.query(
        `
          UPDATE users
          SET games_played = games_played + 1,
              wins = wins + $1
          WHERE id = $2
        `,
        [isWinner ? 1 : 0, user.id]
      );
    }

    return { transferredPoints: 0 };
  };

  const applyMemorySettlement = ({
    game,
    winnerName,
    isDraw,
  }) => {
    const users = Array.isArray(getMemoryUsers?.()) ? getMemoryUsers() : [];
    const hostName = String(game.hostName || '').trim();
    const guestName = String(game.guestName || '').trim();
    const participants = [hostName, guestName].filter(Boolean);
    if (participants.length === 0) {
      return { transferredPoints: 0 };
    }

    const findUser = (username) =>
      users.find((user) => normalizeParticipantKey(user?.username) === normalizeParticipantKey(username));

    const canonicalWinner = String(winnerName || '').trim();
    const winnerKey = normalizeParticipantKey(canonicalWinner);
    const stake = Math.max(0, Math.floor(Number(game.points || 0)));

    if (!isDraw && canonicalWinner && participants.length === 2) {
      const loserName = participants.find((name) => normalizeParticipantKey(name) !== winnerKey);
      const winnerUser = findUser(canonicalWinner);
      const loserUser = loserName ? findUser(loserName) : null;

      if (winnerUser) {
        const transferable = loserUser
          ? Math.min(stake, Math.max(0, Math.floor(Number(loserUser.points || 0))))
          : 0;
        winnerUser.points = Math.max(0, Math.floor(Number(winnerUser.points || 0))) + transferable;
        winnerUser.wins = Math.max(0, Math.floor(Number(winnerUser.wins || 0))) + 1;
        winnerUser.gamesPlayed = Math.max(0, Math.floor(Number(winnerUser.gamesPlayed || 0))) + 1;
        if (loserUser) {
          loserUser.points = Math.max(0, Math.floor(Number(loserUser.points || 0)) - transferable);
          loserUser.gamesPlayed = Math.max(0, Math.floor(Number(loserUser.gamesPlayed || 0))) + 1;
        }
        return { transferredPoints: transferable };
      }
    }

    for (const participantName of participants) {
      const user = findUser(participantName);
      if (!user) continue;
      user.gamesPlayed = Math.max(0, Math.floor(Number(user.gamesPlayed || 0))) + 1;
      if (
        !isDraw &&
        canonicalWinner &&
        normalizeParticipantKey(participantName) === winnerKey
      ) {
        user.wins = Math.max(0, Math.floor(Number(user.wins || 0))) + 1;
      }
    }

    return { transferredPoints: 0 };
  };

  const mapTransitionError = (transitionResult) => ({
    error: transitionResult.message,
    code: transitionResult.code,
    fromStatus: transitionResult.from,
    toStatus: transitionResult.to,
  });

  const getGames = async (req, res) => {
    const adminActor = isAdminActor(req.user);
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const actorCafeId = Number(req.user?.cafe_id || 0);
    const requestedTableCode = normalizeTableCode(req.query?.table);
    const scopeAllRequested = String(req.query?.scope || '').trim().toLowerCase() === 'all';
    const hasCheckIn =
      actorCafeId > 0 &&
      Boolean(actorTableCode);
    const effectiveTableCode = adminActor
      ? requestedTableCode
      : scopeAllRequested
        ? null
        : actorTableCode;

    if (!adminActor && !hasCheckIn) {
      return res.json([]);
    }

    if (await isDbConnected()) {
      const result = !adminActor && scopeAllRequested
        ? await pool.query(
            `
            SELECT
              g.id,
              g.host_name as "hostName",
              g.game_type as "gameType",
              g.points,
              g.table_code as "table",
              g.status,
              g.guest_name as "guestName",
              g.created_at as "createdAt"
            FROM games g
            INNER JOIN users u ON LOWER(u.username) = LOWER(g.host_name)
            WHERE g.status = 'waiting'
              AND g.game_type = ANY($1::text[])
              AND u.cafe_id = $2
            ORDER BY g.created_at DESC
          `,
            [[...supportedGameTypes], actorCafeId]
          )
        : effectiveTableCode
          ? await pool.query(
            `
            SELECT 
              id, 
              host_name as "hostName", 
              game_type as "gameType", 
              points, 
              table_code as "table", 
              status, 
              guest_name as "guestName", 
              created_at as "createdAt" 
            FROM games 
            WHERE status = 'waiting'
              AND game_type = ANY($1::text[])
              AND table_code = $2
            ORDER BY created_at DESC
          `,
            [[...supportedGameTypes], effectiveTableCode]
          )
          : await pool.query(
            `
            SELECT 
              id, 
              host_name as "hostName", 
              game_type as "gameType", 
              points, 
              table_code as "table", 
              status, 
              guest_name as "guestName", 
              created_at as "createdAt" 
            FROM games 
            WHERE status = 'waiting'
              AND game_type = ANY($1::text[])
            ORDER BY created_at DESC
          `,
            [[...supportedGameTypes]]
          );
      return res.json(result.rows);
    }

    const memoryUsers = Array.isArray(getMemoryUsers?.()) ? getMemoryUsers() : [];
    const filtered = getMemoryGames().filter((game) => {
      if (String(game.status || '').toLowerCase() !== 'waiting') {
        return false;
      }
      if (!supportedGameTypes.has(String(game.gameType || '').trim())) {
        return false;
      }
      if (!adminActor && scopeAllRequested) {
        const hostName = String(game.hostName || '').trim().toLowerCase();
        const hostUser = memoryUsers.find(
          (user) => String(user?.username || '').trim().toLowerCase() === hostName
        );
        const hostCafeId = Number(hostUser?.cafe_id ?? hostUser?.cafeId ?? 0);
        if (hostCafeId !== actorCafeId) {
          return false;
        }
      }
      if (effectiveTableCode && normalizeTableCode(game.table) !== effectiveTableCode) {
        return false;
      }
      return true;
    });
    return res.json(filtered);
  };

  const createGame = async (req, res) => {
    const hostName = String(req.user?.username || '').trim();
    const gameType = normalizeGameType(req.body?.gameType);
    const points = Math.max(0, Math.floor(Number(req.body?.points || 0)));
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const table = actorTableCode || normalizeTableCode(req.body?.table) || 'MASA00';
    const adminActor = isAdminActor(req.user);
    const hasCheckIn = Boolean(req.user?.cafe_id) && Boolean(actorTableCode);
    const actorPoints = Math.max(0, Math.floor(Number(req.user?.points || 0)));

    if (!hostName || !gameType) {
      return res.status(400).json({ error: 'hostName ve gameType zorunludur.' });
    }
    if (!adminActor && !hasCheckIn) {
      return res.status(403).json({ error: 'Oyun kurmak için önce kafe check-in işlemi yapmalısın.' });
    }
    if (points > actorPoints && !adminActor) {
      return res.status(400).json({ error: 'Katılım puanı mevcut bakiyenden yüksek olamaz.' });
    }
    if (points > 5000) {
      return res.status(400).json({ error: 'Katılım puanı üst limiti aşıldı.' });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existingGame = await client.query(
          `
            SELECT
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              created_at as "createdAt"
            FROM games
            WHERE (host_name = $1 OR guest_name = $1)
              AND status IN ('waiting', 'active')
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
          `,
          [hostName]
        );

        if (existingGame.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Önce mevcut oyunu tamamla veya lobiye dön.',
            game: existingGame.rows[0],
          });
        }

        const initialGameState = isChessGameType(gameType)
          ? { chess: createInitialChessState(req.body?.chessClock) }
          : {};

        const result = await client.query(
          `
            INSERT INTO games (host_name, game_type, points, table_code, status, game_state)
            VALUES ($1, $2, $3, $4, 'waiting', $5::jsonb)
            RETURNING
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              game_state as "gameState",
              created_at as "createdAt"
          `,
          [hostName, gameType, points, table, JSON.stringify(initialGameState)]
        );

        await client.query('COMMIT');
        const createdGame = result.rows[0];
        emitLobbyUpdate({
          action: 'game_created',
          gameId: createdGame.id,
          table: createdGame.table,
          status: createdGame.status,
        });
        return res.status(201).json(createdGame);
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Create game error', err);
        return res.status(500).json({ error: 'Oyun kurulamadı.' });
      } finally {
        client.release();
      }
    }

    const memoryGames = getMemoryGames();
    const existingMemoryGame = memoryGames.find(
      (game) =>
        (game.hostName === hostName || game.guestName === hostName) &&
        (game.status === 'waiting' || game.status === 'active')
    );
    if (existingMemoryGame) {
      return res.status(409).json({
        error: 'Önce mevcut oyunu tamamla veya lobiye dön.',
        game: existingMemoryGame,
      });
    }

    const newGame = {
      id: Date.now(),
      hostName,
      gameType,
      points,
      table,
      status: 'waiting',
      guestName: null,
      gameState: isChessGameType(gameType) ? { chess: createInitialChessState(req.body?.chessClock) } : {},
      createdAt: new Date().toISOString(),
    };
    const nextGames = [newGame, ...memoryGames];
    setMemoryGames(nextGames);
    emitLobbyUpdate({
      action: 'game_created',
      gameId: newGame.id,
      table: newGame.table,
      status: newGame.status,
    });
    return res.status(201).json(newGame);
  };

  const joinGame = async (req, res) => {
    const { id } = req.params;
    const guestName = String(req.user?.username || '').trim();
    const adminActor = isAdminActor(req.user);
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const hasCheckIn = Boolean(req.user?.cafe_id) && Boolean(actorTableCode);

    if (!guestName) {
      return res.status(400).json({ error: 'guestName zorunludur.' });
    }
    if (!adminActor && !hasCheckIn) {
      return res.status(403).json({ error: 'Oyuna katılmak için önce kafe check-in işlemi yapmalısın.' });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameResult = await client.query(
          `
            SELECT
              id,
              host_name,
              game_type,
              points,
              table_code,
              status,
              guest_name,
              game_state,
              created_at
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (gameResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];
        if (String(game.host_name || '').toLowerCase() === guestName.toLowerCase()) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Kendi oyununa katılamazsın.' });
        }

        if (game.status === 'finished') {
          const finishedJoinTransition = assertGameStatusTransition({
            fromStatus: game.status,
            toStatus: GAME_STATUS.ACTIVE,
            context: 'join_game',
          });
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(finishedJoinTransition));
        }

        const requiredStake = Math.max(0, Math.floor(Number(game.points || 0)));
        const actorPoints = Number(req.user?.points);
        if (!adminActor && Number.isFinite(actorPoints) && actorPoints < requiredStake) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Bu oyuna katılmak için en az ${requiredStake} puan gerekli.`,
          });
        }

        if (game.status === 'active') {
          const canonicalGuest = normalizeParticipantName(guestName, game);
          if (
            canonicalGuest &&
            String(game.guest_name || '').trim() &&
            canonicalGuest.toLowerCase() === String(game.guest_name).toLowerCase()
          ) {
            await client.query('COMMIT');
            return res.json({
              success: true,
              game: {
                id: game.id,
                hostName: game.host_name,
                gameType: game.game_type,
                points: game.points,
                table: game.table_code,
                status: game.status,
                guestName: game.guest_name,
                gameState: game.game_state,
                createdAt: game.created_at,
              },
            });
          }

          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Oyun dolu.' });
        }

        const joinTransition = assertGameStatusTransition({
          fromStatus: game.status,
          toStatus: GAME_STATUS.ACTIVE,
          context: 'join_game',
        });
        if (!joinTransition.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(joinTransition));
        }

        const playerBusy = await client.query(
          `
            SELECT id
            FROM games
            WHERE id <> $1
              AND status = 'active'
              AND (host_name = $2 OR guest_name = $2)
            LIMIT 1
          `,
          [id, guestName]
        );

        if (playerBusy.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu kullanıcı zaten aktif bir oyunda.' });
        }

        const nextGameState = (() => {
          const current =
            game.game_state && typeof game.game_state === 'object' ? { ...game.game_state } : {};
          if (!isChessGameType(game.game_type)) return current;
          return {
            ...current,
            chess: activateChessClockState(current.chess),
          };
        })();

        const updatedResult = await client.query(
          `
            UPDATE games
            SET status = 'active',
                guest_name = $1,
                game_state = $3::jsonb
            WHERE id = $2
              AND status = 'waiting'
            RETURNING
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              game_state as "gameState",
              created_at as "createdAt"
          `,
          [guestName, id, JSON.stringify(nextGameState)]
        );

        if (updatedResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun artık katılıma uygun değil.' });
        }

        await client.query('COMMIT');
        const joinedGame = updatedResult.rows[0];
        emitRealtimeUpdate(joinedGame.id, {
          type: 'game_joined',
          gameId: joinedGame.id,
          status: joinedGame.status,
          guestName: joinedGame.guestName,
          gameState: joinedGame.gameState || {},
        });
        emitLobbyUpdate({
          action: 'game_joined',
          gameId: joinedGame.id,
          table: joinedGame.table,
          status: joinedGame.status,
        });
        return res.json({ success: true, game: joinedGame });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Join game error', err);
        return res.status(500).json({ error: 'Oyuna katılım sırasında hata oluştu.' });
      } finally {
        client.release();
      }
    }

    const memoryGames = getMemoryGames();
    const game = memoryGames.find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }
    if (String(game.hostName || '').toLowerCase() === guestName.toLowerCase()) {
      return res.status(400).json({ error: 'Kendi oyununa katılamazsın.' });
    }
    if (game.status === 'finished') {
      const finishedJoinTransition = assertGameStatusTransition({
        fromStatus: game.status,
        toStatus: GAME_STATUS.ACTIVE,
        context: 'join_game_memory',
      });
      return res.status(409).json(mapTransitionError(finishedJoinTransition));
    }
    {
      const requiredStake = Math.max(0, Math.floor(Number(game.points || 0)));
      const actorPoints = Number(req.user?.points);
      if (!adminActor && Number.isFinite(actorPoints) && actorPoints < requiredStake) {
        return res.status(400).json({
          error: `Bu oyuna katılmak için en az ${requiredStake} puan gerekli.`,
        });
      }
    }
    if (game.status === 'active') {
      if (String(game.guestName || '').toLowerCase() === guestName.toLowerCase()) {
        return res.json({ success: true, game });
      }
      return res.status(409).json({ error: 'Oyun dolu.' });
    }

    const memoryJoinTransition = assertGameStatusTransition({
      fromStatus: game.status,
      toStatus: GAME_STATUS.ACTIVE,
      context: 'join_game_memory',
    });
    if (!memoryJoinTransition.ok) {
      return res.status(409).json(mapTransitionError(memoryJoinTransition));
    }

    game.status = 'active';
    game.guestName = guestName;
    if (isChessGameType(game.gameType)) {
      const current = game.gameState && typeof game.gameState === 'object' ? { ...game.gameState } : {};
      game.gameState = {
        ...current,
        chess: activateChessClockState(current.chess),
      };
    }
    emitRealtimeUpdate(game.id, {
      type: 'game_joined',
      gameId: game.id,
      status: game.status,
      guestName: game.guestName,
      gameState: game.gameState || {},
    });
    emitLobbyUpdate({
      action: 'game_joined',
      gameId: game.id,
      table: game.table,
      status: game.status,
    });
    return res.json({ success: true, game });
  };

  const getGameState = async (req, res) => {
    const { id } = req.params;
    const actor = String(req.user?.username || '').trim().toLowerCase();
    const adminActor = isAdminActor(req.user);
    if (await isDbConnected()) {
      const baseSelectQuery = `
        SELECT
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          winner,
          player1_move as "player1Move",
          player2_move as "player2Move",
          game_state as "gameState",
          created_at as "createdAt"
        FROM games
        WHERE id = $1
      `;

      const result = await pool.query(baseSelectQuery, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Game not found' });
      }

      let row = result.rows[0];
      const host = String(row.hostName || '').trim().toLowerCase();
      const guest = String(row.guestName || '').trim().toLowerCase();
      if (!adminActor && actor && actor !== host && actor !== guest) {
        return res.status(403).json({ error: 'Bu oyunun detaylarını görme yetkin yok.' });
      }

      const timeoutResolution = buildChessTimeoutResolution({
        gameType: row.gameType,
        status: row.status,
        hostName: row.hostName,
        guestName: row.guestName,
        gameState: row.gameState,
      });

      if (timeoutResolution) {
        const updateResult = await pool.query(
          `
            UPDATE games
            SET status = 'finished',
                winner = $2::text,
                game_state = $3::jsonb
            WHERE id = $1
              AND status = 'active'
            RETURNING
              id,
              host_name as "hostName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              guest_name as "guestName",
              winner,
              player1_move as "player1Move",
              player2_move as "player2Move",
              game_state as "gameState",
              created_at as "createdAt"
          `,
          [id, timeoutResolution.winner, JSON.stringify(timeoutResolution.nextGameState)]
        );

        if (updateResult.rows.length > 0) {
          row = updateResult.rows[0];
          emitRealtimeUpdate(id, {
            type: 'game_finished',
            gameId: id,
            status: 'finished',
            winner: timeoutResolution.winner,
            reason: 'timeout',
            chess: timeoutResolution.nextChessState,
            gameState: timeoutResolution.nextGameState,
          });
        } else {
          const refreshed = await pool.query(baseSelectQuery, [id]);
          if (refreshed.rows.length > 0) {
            row = refreshed.rows[0];
          }
        }
      }

      return res.json(row);
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const host = String(game.hostName || '').trim().toLowerCase();
    const guest = String(game.guestName || '').trim().toLowerCase();
    if (!adminActor && actor && actor !== host && actor !== guest) {
      return res.status(403).json({ error: 'Bu oyunun detaylarını görme yetkin yok.' });
    }

    const timeoutResolution = buildChessTimeoutResolution({
      gameType: game.gameType,
      status: game.status,
      hostName: game.hostName,
      guestName: game.guestName,
      gameState: game.gameState,
    });

    if (timeoutResolution) {
      const timeoutTransition = assertGameStatusTransition({
        fromStatus: game.status,
        toStatus: GAME_STATUS.FINISHED,
        context: 'chess_timeout_read_memory',
      });
      if (timeoutTransition.ok) {
        game.status = GAME_STATUS.FINISHED;
        game.winner = timeoutResolution.winner;
        game.gameState = timeoutResolution.nextGameState;
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: game.status,
          winner: timeoutResolution.winner,
          reason: 'timeout',
          chess: timeoutResolution.nextChessState,
          gameState: timeoutResolution.nextGameState,
        });
      }
    }

    return res.json(game);
  };

  const getUserGameHistory = async (req, res) => {
    const targetUsername = String(req.params?.username || '').trim();
    const actorUsername = String(req.user?.username || '').trim();
    const adminActor = isAdminActor(req.user);

    if (!targetUsername) {
      return res.status(400).json({ error: 'username zorunludur.' });
    }

    if (!adminActor && actorUsername.toLowerCase() !== targetUsername.toLowerCase()) {
      return res.status(403).json({ error: 'Sadece kendi oyun geçmişini görüntüleyebilirsin.' });
    }

    const mapHistoryRow = (game) => {
      const hostName = String(game.hostName || game.host_name || '').trim();
      const guestName = String(game.guestName || game.guest_name || '').trim();
      const actorLower = targetUsername.toLowerCase();
      const isHost = hostName.toLowerCase() === actorLower;
      const opponentName = isHost ? guestName || 'Rakip' : hostName || 'Rakip';
      const winner = game.winner ? String(game.winner) : null;
      const gameState = game.gameState && typeof game.gameState === 'object' ? game.gameState : {};
      const chessState = gameState.chess && typeof gameState.chess === 'object' ? gameState.chess : {};
      const moveHistory = Array.isArray(chessState.moveHistory) ? chessState.moveHistory : [];
      const clockState = chessState.clock && typeof chessState.clock === 'object' ? chessState.clock : {};
      const baseMs = Number(clockState.baseMs);
      const incrementMs = Number(clockState.incrementMs);
      const tempoLabel =
        Number.isFinite(baseMs) && Number.isFinite(incrementMs)
          ? `${Math.round(baseMs / 60000)}+${Math.round(incrementMs / 1000)}`
          : null;

      return {
        id: game.id,
        gameType: String(game.gameType || game.game_type || ''),
        points: Math.max(0, Number(game.points || 0)),
        table: String(game.table || game.table_code || ''),
        status: String(game.status || ''),
        winner,
        didWin: Boolean(winner) && winner.toLowerCase() === targetUsername.toLowerCase(),
        opponentName,
        createdAt: game.createdAt || game.created_at || new Date().toISOString(),
        moveCount: moveHistory.length,
        chessTempo: tempoLabel,
      };
    };

    if (await isDbConnected()) {
      try {
        const result = await pool.query(
          `
            SELECT
              id,
              host_name as "hostName",
              guest_name as "guestName",
              game_type as "gameType",
              points,
              table_code as "table",
              status,
              winner,
              game_state as "gameState",
              created_at as "createdAt"
            FROM games
            WHERE status = 'finished'
              AND game_type = ANY($2::text[])
              AND (
                LOWER(host_name) = LOWER($1)
                OR LOWER(COALESCE(guest_name, '')) = LOWER($1)
              )
            ORDER BY created_at DESC
            LIMIT 25
          `,
          [targetUsername, [...supportedGameTypes]]
        );

        return res.json(result.rows.map(mapHistoryRow));
      } catch (err) {
        logger.error('Get game history error', err);
        return res.status(500).json({ error: 'Oyun geçmişi yüklenemedi.' });
      }
    }

    const history = getMemoryGames()
      .filter((game) => {
        const status = String(game.status || '').toLowerCase();
        if (status !== 'finished') return false;
        if (!supportedGameTypes.has(String(game.gameType || '').trim())) return false;
        const hostLower = String(game.hostName || '').toLowerCase();
        const guestLower = String(game.guestName || '').toLowerCase();
        return hostLower === targetUsername.toLowerCase() || guestLower === targetUsername.toLowerCase();
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 25)
      .map(mapHistoryRow);

    return res.json(history);
  };

  const { makeMove } = createGameMoveService({
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    isAdminActor,
    isChessGameType,
    resolveParticipantColor,
    sanitizeChessMovePayload,
    createInitialChessState,
    buildChessStateFromEngine,
    assertGameStatusTransition,
    assertRequiredGameStatus,
    mapTransitionError,
    sanitizeLiveSubmission,
    getGameParticipants,
    pickWinnerFromResults,
    sanitizeScoreSubmission,
    getMemoryGames,
    emitRealtimeUpdate,
  });

  const drawOffer = async (req, res) => {
    const { id } = req.params;
    const action = normalizeDrawOfferAction(req.body?.action);
    const actorName = String(req.user?.username || '').trim();
    if (!action) {
      return res.status(400).json({ error: 'Geçersiz beraberlik aksiyonu.' });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `
            SELECT id, host_name, guest_name, game_type, points, status, winner, game_state
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = result.rows[0];
        const actorParticipant = normalizeParticipantName(actorName, game);
        if (!actorParticipant) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunda beraberlik işlemi yapma yetkin yok.' });
        }
        if (!isChessGameType(game.game_type)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Beraberlik teklifi sadece satranç oyununda kullanılabilir.' });
        }
        const drawOfferStatus = assertRequiredGameStatus({
          currentStatus: game.status,
          requiredStatus: GAME_STATUS.ACTIVE,
          context: 'draw_offer',
        });
        if (!drawOfferStatus.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(drawOfferStatus));
        }

        const nowIso = new Date().toISOString();
        const currentGameState =
          game.game_state && typeof game.game_state === 'object'
            ? { ...game.game_state }
            : {};
        const chessState =
          currentGameState.chess && typeof currentGameState.chess === 'object'
            ? { ...currentGameState.chess }
            : createInitialChessState();
        const pendingOffer = (() => {
          const offer = normalizeDrawOffer(chessState.drawOffer);
          return offer && offer.status === 'pending' ? offer : null;
        })();
        const actorKey = normalizeParticipantKey(actorParticipant);
        const isPendingByActor =
          pendingOffer && normalizeParticipantKey(pendingOffer.offeredBy) === actorKey;
        const isPendingByOpponent = pendingOffer && !isPendingByActor;

        if (action === 'offer') {
          if (isPendingByActor) {
            await client.query('ROLLBACK');
            return res.json({ success: true, drawOffer: pendingOffer, pending: true });
          }
          if (isPendingByOpponent) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Rakibin beraberlik teklifine önce yanıt ver.' });
          }

          const nextOffer = {
            status: 'pending',
            offeredBy: actorParticipant,
            createdAt: nowIso,
          };
          const nextChessState = {
            ...chessState,
            drawOffer: nextOffer,
            updatedAt: nowIso,
          };
          const nextGameState = {
            ...currentGameState,
            chess: nextChessState,
          };
          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(nextGameState), id]
          );
          await client.query('COMMIT');
          emitRealtimeUpdate(id, {
            type: 'draw_offer_updated',
            gameId: id,
            action: 'offer',
            drawOffer: nextOffer,
            gameState: nextGameState,
          });
          return res.json({ success: true, drawOffer: nextOffer });
        }

        if (action === 'cancel') {
          if (!isPendingByActor) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'İptal edilecek aktif beraberlik teklifin yok.' });
          }
          const nextOffer = {
            ...pendingOffer,
            status: 'cancelled',
            respondedBy: actorParticipant,
            respondedAt: nowIso,
          };
          const nextChessState = {
            ...chessState,
            drawOffer: nextOffer,
            updatedAt: nowIso,
          };
          const nextGameState = {
            ...currentGameState,
            chess: nextChessState,
          };
          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(nextGameState), id]
          );
          await client.query('COMMIT');
          emitRealtimeUpdate(id, {
            type: 'draw_offer_updated',
            gameId: id,
            action: 'cancel',
            drawOffer: nextOffer,
            gameState: nextGameState,
          });
          return res.json({ success: true, drawOffer: nextOffer });
        }

        if (action === 'reject') {
          if (!isPendingByOpponent) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Yanıtlanacak rakip beraberlik teklifi yok.' });
          }
          const nextOffer = {
            ...pendingOffer,
            status: 'rejected',
            respondedBy: actorParticipant,
            respondedAt: nowIso,
          };
          const nextChessState = {
            ...chessState,
            drawOffer: nextOffer,
            updatedAt: nowIso,
          };
          const nextGameState = {
            ...currentGameState,
            chess: nextChessState,
          };
          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(nextGameState), id]
          );
          await client.query('COMMIT');
          emitRealtimeUpdate(id, {
            type: 'draw_offer_updated',
            gameId: id,
            action: 'reject',
            drawOffer: nextOffer,
            gameState: nextGameState,
          });
          return res.json({ success: true, drawOffer: nextOffer });
        }

        if (!isPendingByOpponent) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Onaylanacak rakip beraberlik teklifi yok.' });
        }

        const nextOffer = {
          ...pendingOffer,
          status: 'accepted',
          respondedBy: actorParticipant,
          respondedAt: nowIso,
        };
        const nextChessState = {
          ...chessState,
          drawOffer: nextOffer,
          winner: null,
          result: 'draw-agreement',
          isGameOver: true,
          clock: chessState.clock && typeof chessState.clock === 'object'
            ? {
                ...chessState.clock,
                lastTickAt: null,
              }
            : chessState.clock,
          updatedAt: nowIso,
        };
        const nextGameState = {
          ...currentGameState,
          chess: nextChessState,
        };
        if (nextGameState.resolvedWinner) {
          delete nextGameState.resolvedWinner;
        }

        const drawTransition = assertGameStatusTransition({
          fromStatus: game.status,
          toStatus: GAME_STATUS.FINISHED,
          context: 'draw_offer_accept',
        });
        if (!drawTransition.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(drawTransition));
        }

        const settlement = await applyDbSettlement({
          client,
          game,
          winnerName: null,
          isDraw: true,
        });
        nextGameState.settlementApplied = true;
        nextGameState.stakeTransferred = settlement.transferredPoints;
        nextGameState.settledAt = nowIso;

        await client.query(
          `
            UPDATE games
            SET status = 'finished',
                winner = NULL,
                game_state = $1::jsonb
            WHERE id = $2
          `,
          [JSON.stringify(nextGameState), id]
        );
        await client.query('COMMIT');
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: 'finished',
          winner: null,
          draw: true,
          reason: 'draw_agreement',
          drawOffer: nextOffer,
          chess: nextChessState,
          gameState: nextGameState,
        });
        return res.json({ success: true, winner: null, draw: true, drawOffer: nextOffer });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Draw offer error', err);
        return res.status(500).json({ error: 'Beraberlik teklifi işlenemedi.' });
      } finally {
        client.release();
      }
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }
    const actorParticipant = normalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    if (!actorParticipant) {
      return res.status(403).json({ error: 'Bu oyunda beraberlik işlemi yapma yetkin yok.' });
    }
    if (!isChessGameType(game.gameType)) {
      return res.status(400).json({ error: 'Beraberlik teklifi sadece satranç oyununda kullanılabilir.' });
    }
    const drawOfferStatus = assertRequiredGameStatus({
      currentStatus: game.status,
      requiredStatus: GAME_STATUS.ACTIVE,
      context: 'draw_offer_memory',
    });
    if (!drawOfferStatus.ok) {
      return res.status(409).json(mapTransitionError(drawOfferStatus));
    }

    const nowIso = new Date().toISOString();
    const currentGameState =
      game.gameState && typeof game.gameState === 'object' ? { ...game.gameState } : {};
    const chessState =
      currentGameState.chess && typeof currentGameState.chess === 'object'
        ? { ...currentGameState.chess }
        : createInitialChessState();
    const pendingOffer = (() => {
      const offer = normalizeDrawOffer(chessState.drawOffer);
      return offer && offer.status === 'pending' ? offer : null;
    })();
    const actorKey = normalizeParticipantKey(actorParticipant);
    const isPendingByActor =
      pendingOffer && normalizeParticipantKey(pendingOffer.offeredBy) === actorKey;
    const isPendingByOpponent = pendingOffer && !isPendingByActor;

    if (action === 'offer') {
      if (isPendingByActor) {
        return res.json({ success: true, drawOffer: pendingOffer, pending: true });
      }
      if (isPendingByOpponent) {
        return res.status(409).json({ error: 'Rakibin beraberlik teklifine önce yanıt ver.' });
      }
      const nextOffer = {
        status: 'pending',
        offeredBy: actorParticipant,
        createdAt: nowIso,
      };
      game.gameState = {
        ...currentGameState,
        chess: {
          ...chessState,
          drawOffer: nextOffer,
          updatedAt: nowIso,
        },
      };
      emitRealtimeUpdate(id, {
        type: 'draw_offer_updated',
        gameId: id,
        action: 'offer',
        drawOffer: nextOffer,
        gameState: game.gameState,
      });
      return res.json({ success: true, drawOffer: nextOffer });
    }

    if (action === 'cancel') {
      if (!isPendingByActor) {
        return res.status(409).json({ error: 'İptal edilecek aktif beraberlik teklifin yok.' });
      }
      const nextOffer = {
        ...pendingOffer,
        status: 'cancelled',
        respondedBy: actorParticipant,
        respondedAt: nowIso,
      };
      game.gameState = {
        ...currentGameState,
        chess: {
          ...chessState,
          drawOffer: nextOffer,
          updatedAt: nowIso,
        },
      };
      emitRealtimeUpdate(id, {
        type: 'draw_offer_updated',
        gameId: id,
        action: 'cancel',
        drawOffer: nextOffer,
        gameState: game.gameState,
      });
      return res.json({ success: true, drawOffer: nextOffer });
    }

    if (action === 'reject') {
      if (!isPendingByOpponent) {
        return res.status(409).json({ error: 'Yanıtlanacak rakip beraberlik teklifi yok.' });
      }
      const nextOffer = {
        ...pendingOffer,
        status: 'rejected',
        respondedBy: actorParticipant,
        respondedAt: nowIso,
      };
      game.gameState = {
        ...currentGameState,
        chess: {
          ...chessState,
          drawOffer: nextOffer,
          updatedAt: nowIso,
        },
      };
      emitRealtimeUpdate(id, {
        type: 'draw_offer_updated',
        gameId: id,
        action: 'reject',
        drawOffer: nextOffer,
        gameState: game.gameState,
      });
      return res.json({ success: true, drawOffer: nextOffer });
    }

    if (!isPendingByOpponent) {
      return res.status(409).json({ error: 'Onaylanacak rakip beraberlik teklifi yok.' });
    }
    const drawTransition = assertGameStatusTransition({
      fromStatus: normalizeGameStatus(game.status),
      toStatus: GAME_STATUS.FINISHED,
      context: 'draw_offer_accept_memory',
    });
    if (!drawTransition.ok) {
      return res.status(409).json(mapTransitionError(drawTransition));
    }

    const nextOffer = {
      ...pendingOffer,
      status: 'accepted',
      respondedBy: actorParticipant,
      respondedAt: nowIso,
    };
    const nextGameState = {
      ...currentGameState,
      chess: {
        ...chessState,
        drawOffer: nextOffer,
        winner: null,
        result: 'draw-agreement',
        isGameOver: true,
        clock: chessState.clock && typeof chessState.clock === 'object'
          ? {
              ...chessState.clock,
              lastTickAt: null,
            }
          : chessState.clock,
        updatedAt: nowIso,
      },
    };
    if (nextGameState.resolvedWinner) {
      delete nextGameState.resolvedWinner;
    }

    game.status = GAME_STATUS.FINISHED;
    game.winner = null;
    const settlement = applyMemorySettlement({
      game,
      winnerName: null,
      isDraw: true,
    });
    nextGameState.settlementApplied = true;
    nextGameState.stakeTransferred = settlement.transferredPoints;
    nextGameState.settledAt = nowIso;
    game.gameState = nextGameState;

    emitRealtimeUpdate(id, {
      type: 'game_finished',
      gameId: id,
      status: game.status,
      winner: null,
      draw: true,
      reason: 'draw_agreement',
      drawOffer: nextOffer,
      chess: nextGameState.chess,
      gameState: nextGameState,
    });
    return res.json({ success: true, winner: null, draw: true, drawOffer: nextOffer });
  };

  const resignGame = async (req, res) => {
    const { id } = req.params;
    const actorName = String(req.user?.username || '').trim();

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(
          `
            SELECT id, host_name, guest_name, game_type, points, status, winner, game_state
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = result.rows[0];
        const actorParticipant = normalizeParticipantName(actorName, game);
        if (!actorParticipant) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunda teslim olma yetkin yok.' });
        }
        const resignStatus = assertRequiredGameStatus({
          currentStatus: game.status,
          requiredStatus: GAME_STATUS.ACTIVE,
          context: 'resign_game',
        });
        if (!resignStatus.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(resignStatus));
        }

        const winnerByResign = findOpponentName(actorParticipant, game);
        if (!winnerByResign) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Rakip bulunamadığı için teslim işlemi yapılamadı.' });
        }

        const resignTransition = assertGameStatusTransition({
          fromStatus: game.status,
          toStatus: GAME_STATUS.FINISHED,
          context: 'resign_game',
        });
        if (!resignTransition.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(resignTransition));
        }

        const nowIso = new Date().toISOString();
        const currentGameState =
          game.game_state && typeof game.game_state === 'object'
            ? { ...game.game_state }
            : {};
        const currentChessState =
          currentGameState.chess && typeof currentGameState.chess === 'object'
            ? { ...currentGameState.chess }
            : null;

        const nextGameState = {
          ...currentGameState,
          resolvedWinner: winnerByResign,
          resignedBy: actorParticipant,
          resignedAt: nowIso,
        };

        if (currentChessState) {
          nextGameState.chess = {
            ...currentChessState,
            winner: winnerByResign,
            result: 'resign',
            isGameOver: true,
            clock: currentChessState.clock && typeof currentChessState.clock === 'object'
              ? {
                  ...currentChessState.clock,
                  lastTickAt: null,
                }
              : currentChessState.clock,
            updatedAt: nowIso,
          };
        }

        const settlement = await applyDbSettlement({
          client,
          game,
          winnerName: winnerByResign,
          isDraw: false,
        });
        nextGameState.settlementApplied = true;
        nextGameState.stakeTransferred = settlement.transferredPoints;
        nextGameState.settledAt = nowIso;

        await client.query(
          `
            UPDATE games
            SET status = 'finished',
                winner = $1::text,
                game_state = $2::jsonb
            WHERE id = $3
          `,
          [winnerByResign, JSON.stringify(nextGameState), id]
        );
        await client.query('COMMIT');
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: 'finished',
          winner: winnerByResign,
          reason: 'resign',
          gameState: nextGameState,
        });
        return res.json({ success: true, winner: winnerByResign, reason: 'resign' });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Resign game error', err);
        return res.status(500).json({ error: 'Teslim olma işlemi başarısız.' });
      } finally {
        client.release();
      }
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }

    const actorParticipant = normalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    if (!actorParticipant) {
      return res.status(403).json({ error: 'Bu oyunda teslim olma yetkin yok.' });
    }
    const resignStatus = assertRequiredGameStatus({
      currentStatus: game.status,
      requiredStatus: GAME_STATUS.ACTIVE,
      context: 'resign_game_memory',
    });
    if (!resignStatus.ok) {
      return res.status(409).json(mapTransitionError(resignStatus));
    }

    const winnerByResign = findOpponentName(actorParticipant, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    if (!winnerByResign) {
      return res.status(409).json({ error: 'Rakip bulunamadığı için teslim işlemi yapılamadı.' });
    }

    const resignTransition = assertGameStatusTransition({
      fromStatus: normalizeGameStatus(game.status),
      toStatus: GAME_STATUS.FINISHED,
      context: 'resign_game_memory',
    });
    if (!resignTransition.ok) {
      return res.status(409).json(mapTransitionError(resignTransition));
    }

    const nowIso = new Date().toISOString();
    const currentGameState = game.gameState && typeof game.gameState === 'object' ? { ...game.gameState } : {};
    const currentChessState =
      currentGameState.chess && typeof currentGameState.chess === 'object'
        ? { ...currentGameState.chess }
        : null;

    game.status = GAME_STATUS.FINISHED;
    game.winner = winnerByResign;
    game.gameState = {
      ...currentGameState,
      resolvedWinner: winnerByResign,
      resignedBy: actorParticipant,
      resignedAt: nowIso,
      ...(currentChessState
        ? {
            chess: {
              ...currentChessState,
              winner: winnerByResign,
              result: 'resign',
              isGameOver: true,
              clock: currentChessState.clock && typeof currentChessState.clock === 'object'
                ? {
                    ...currentChessState.clock,
                    lastTickAt: null,
                  }
                : currentChessState.clock,
              updatedAt: nowIso,
            },
          }
        : {}),
    };
    const settlement = applyMemorySettlement({
      game,
      winnerName: winnerByResign,
      isDraw: false,
    });
    game.gameState.settlementApplied = true;
    game.gameState.stakeTransferred = settlement.transferredPoints;
    game.gameState.settledAt = nowIso;

    emitRealtimeUpdate(id, {
      type: 'game_finished',
      gameId: id,
      status: game.status,
      winner: winnerByResign,
      reason: 'resign',
      gameState: game.gameState,
    });
    return res.json({ success: true, winner: winnerByResign, reason: 'resign' });
  };

  const finishGame = async (req, res) => {
    const { id } = req.params;
    const requestedWinner = req.body?.winner;
    const actorName = String(req.user?.username || '').trim();

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const gameResult = await client.query(
          `
            SELECT id, host_name, guest_name, game_type, points, status, winner, game_state
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (gameResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];
        const actorParticipant = normalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
        }

        const participants = getGameParticipants(game);
        const stateResults =
          game.game_state && typeof game.game_state.results === 'object' ? game.game_state.results : {};
        const winnerFromState = normalizeParticipantName(game.game_state?.resolvedWinner, game);
        const winnerFromResults = pickWinnerFromResults(stateResults, participants);
        const winnerFromRequest = normalizeParticipantName(requestedWinner, game);
        const requestedWinnerRaw = String(requestedWinner || '').trim();
        const derivedWinner = winnerFromState || winnerFromResults;
        const manualWinnerAllowed = adminActor && Boolean(winnerFromRequest);
        const finalWinner = derivedWinner || (manualWinnerAllowed ? winnerFromRequest : null);
        const currentGameState =
          game.game_state && typeof game.game_state === 'object'
            ? { ...game.game_state }
            : {};
        const chessState =
          game.game_state && typeof game.game_state.chess === 'object' ? game.game_state.chess : null;
        const isChessDraw =
          isChessGameType(game.game_type) &&
          Boolean(chessState?.isGameOver) &&
          !finalWinner;
        const settlementAlreadyApplied = Boolean(currentGameState?.settlementApplied);

        if (requestedWinnerRaw && !winnerFromRequest && adminActor && !derivedWinner) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Geçersiz kazanan bilgisi.' });
        }

        if (!adminActor && requestedWinnerRaw && !derivedWinner) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Sonuç henüz sunucu tarafından belirlenmedi. Önce tüm skorlar tamamlanmalı.',
            code: 'server_result_pending',
          });
        }

        if (!finalWinner && !isChessDraw && !manualWinnerAllowed) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Sonuç henüz sunucu tarafından belirlenmedi. Her iki oyuncu skoru tamamlamalı.',
            code: 'server_result_pending',
          });
        }

        if (game.status === 'finished') {
          const storedWinner = String(game.winner || '').trim();
          const targetWinner = String(finalWinner || '').trim();
          if (!storedWinner && !targetWinner && isChessDraw) {
            if (!settlementAlreadyApplied) {
              const settlement = await applyDbSettlement({
                client,
                game,
                winnerName: null,
                isDraw: true,
              });
              const patchedState = {
                ...currentGameState,
                settlementApplied: true,
                stakeTransferred: settlement.transferredPoints,
                settledAt: new Date().toISOString(),
              };
              await client.query(
                `
                  UPDATE games
                  SET game_state = $1::jsonb
                  WHERE id = $2
                `,
                [JSON.stringify(patchedState), id]
              );
              await client.query('COMMIT');
              return res.json({
                success: true,
                winner: null,
                alreadyFinished: true,
                draw: true,
                settlementApplied: true,
              });
            }
            await client.query('ROLLBACK');
            return res.json({ success: true, winner: null, alreadyFinished: true, draw: true });
          }
          if (storedWinner.toLowerCase() === targetWinner.toLowerCase()) {
            if (!settlementAlreadyApplied) {
              const settlement = await applyDbSettlement({
                client,
                game,
                winnerName: game.winner || finalWinner,
                isDraw: false,
              });
              const patchedState = {
                ...currentGameState,
                settlementApplied: true,
                stakeTransferred: settlement.transferredPoints,
                settledAt: new Date().toISOString(),
              };
              await client.query(
                `
                  UPDATE games
                  SET game_state = $1::jsonb
                  WHERE id = $2
                `,
                [JSON.stringify(patchedState), id]
              );
              await client.query('COMMIT');
              return res.json({
                success: true,
                winner: game.winner || null,
                alreadyFinished: true,
                settlementApplied: true,
              });
            }
            await client.query('ROLLBACK');
            return res.json({ success: true, winner: game.winner || null, alreadyFinished: true });
          }
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Oyun zaten farklı bir sonuçla tamamlandı.' });
        }

        const finishTransition = assertGameStatusTransition({
          fromStatus: game.status,
          toStatus: GAME_STATUS.FINISHED,
          context: 'finish_game',
        });
        if (!finishTransition.ok) {
          await client.query('ROLLBACK');
          return res.status(409).json(mapTransitionError(finishTransition));
        }

        const nextGameState = { ...currentGameState };
        if (finalWinner) {
          nextGameState.resolvedWinner = finalWinner;
        } else if (nextGameState.resolvedWinner) {
          delete nextGameState.resolvedWinner;
        }

        const settlement = await applyDbSettlement({
          client,
          game,
          winnerName: finalWinner,
          isDraw: Boolean(isChessDraw),
        });
        nextGameState.settlementApplied = true;
        nextGameState.stakeTransferred = settlement.transferredPoints;
        nextGameState.settledAt = new Date().toISOString();

        await client.query(
          `
            UPDATE games
            SET status = 'finished',
                winner = $1::text,
                game_state = $2::jsonb
            WHERE id = $3
          `,
          [finalWinner || null, JSON.stringify(nextGameState), id]
        );

        await client.query('COMMIT');
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: 'finished',
          winner: finalWinner || null,
          draw: Boolean(isChessDraw),
          gameState: nextGameState,
        });
        return res.json({ success: true, winner: finalWinner || null, draw: Boolean(isChessDraw) });
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('Finish game error', err);
        return res.status(500).json({ error: 'Oyun tamamlanamadı.' });
      } finally {
        client.release();
      }
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Oyun bulunamadı.' });
    }

    const actorParticipant = normalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const adminActor = isAdminActor(req.user);
    if (!actorParticipant && !adminActor) {
      return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
    }

    const participants = getGameParticipants({
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const winnerFromState = normalizeParticipantName(game.gameState?.resolvedWinner, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const winnerFromResults = pickWinnerFromResults(game.gameState?.results || {}, participants);
    const winnerFromRequest = normalizeParticipantName(requestedWinner, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const requestedWinnerRaw = String(requestedWinner || '').trim();
    const derivedWinner = winnerFromState || winnerFromResults;
    const manualWinnerAllowed = adminActor && Boolean(winnerFromRequest);
    const finalWinner = derivedWinner || (manualWinnerAllowed ? winnerFromRequest : null);
    const isChessDraw =
      isChessGameType(game.gameType) &&
      Boolean(game.gameState?.chess?.isGameOver) &&
      !finalWinner;

    if (requestedWinnerRaw && !winnerFromRequest && adminActor && !derivedWinner) {
      return res.status(400).json({ error: 'Geçersiz kazanan bilgisi.' });
    }

    if (!adminActor && requestedWinnerRaw && !derivedWinner) {
      return res.status(409).json({
        error: 'Sonuç henüz sunucu tarafından belirlenmedi. Önce tüm skorlar tamamlanmalı.',
        code: 'server_result_pending',
      });
    }

    if (!finalWinner && !isChessDraw && !manualWinnerAllowed) {
      return res.status(409).json({
        error: 'Sonuç henüz sunucu tarafından belirlenmedi. Her iki oyuncu skoru tamamlamalı.',
        code: 'server_result_pending',
      });
    }

    const settlementAlreadyApplied = Boolean(game.gameState?.settlementApplied);
    if (normalizeGameStatus(game.status) === GAME_STATUS.FINISHED) {
      const storedWinner = String(game.winner || '').trim();
      const targetWinner = String(finalWinner || '').trim();
      if (storedWinner.toLowerCase() !== targetWinner.toLowerCase() && !(isChessDraw && !storedWinner && !targetWinner)) {
        return res.status(409).json({ error: 'Oyun zaten farklı bir sonuçla tamamlandı.' });
      }
      if (!settlementAlreadyApplied) {
        const settlement = applyMemorySettlement({
          game,
          winnerName: finalWinner,
          isDraw: Boolean(isChessDraw),
        });
        game.gameState = {
          ...(game.gameState || {}),
          settlementApplied: true,
          stakeTransferred: settlement.transferredPoints,
          settledAt: new Date().toISOString(),
        };
      }
      return res.json({
        success: true,
        winner: game.winner || finalWinner || null,
        alreadyFinished: true,
        draw: Boolean(isChessDraw),
      });
    }

    const memoryFinishTransition = assertGameStatusTransition({
      fromStatus: normalizeGameStatus(game.status),
      toStatus: GAME_STATUS.FINISHED,
      context: 'finish_game_memory',
    });
    if (!memoryFinishTransition.ok) {
      return res.status(409).json(mapTransitionError(memoryFinishTransition));
    }

    game.status = 'finished';
    game.winner = finalWinner || null;
    game.gameState = {
      ...(game.gameState || {}),
      ...(finalWinner ? { resolvedWinner: finalWinner } : {}),
    };
    if (!finalWinner && game.gameState.resolvedWinner) {
      delete game.gameState.resolvedWinner;
    }
    {
      const settlement = applyMemorySettlement({
        game,
        winnerName: finalWinner,
        isDraw: Boolean(isChessDraw),
      });
      game.gameState.settlementApplied = true;
      game.gameState.stakeTransferred = settlement.transferredPoints;
      game.gameState.settledAt = new Date().toISOString();
    }
    emitRealtimeUpdate(id, {
      type: 'game_finished',
      gameId: id,
      status: 'finished',
      winner: finalWinner || null,
      draw: Boolean(isChessDraw),
      gameState: game.gameState,
    });
    return res.json({ success: true, winner: finalWinner || null, draw: Boolean(isChessDraw) });
  };

  const deleteGame = async (req, res) => {
    const { id } = req.params;

    if (await isDbConnected()) {
      const result = await pool.query(
        `
          DELETE FROM games
          WHERE id = $1
            AND (
              LOWER(host_name) = LOWER($2)
              OR LOWER(COALESCE(guest_name, '')) = LOWER($2)
              OR $3 = true
            )
          RETURNING id
        `,
        [id, req.user?.username || '', isAdminActor(req.user)]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
      }
      emitLobbyUpdate({
        action: 'game_deleted',
        gameId: id,
      });
      return res.json({ success: true });
    }

    const currentGames = getMemoryGames();
    const nextGames = currentGames.filter((game) => {
      if (String(game.id) !== String(id)) return true;
      if (isAdminActor(req.user)) return false;
      const actor = String(req.user?.username || '').toLowerCase();
      return String(game.hostName || '').toLowerCase() !== actor && String(game.guestName || '').toLowerCase() !== actor;
    });
    if (nextGames.length === currentGames.length) {
      return res.status(404).json({ error: 'Oyun bulunamadı veya silme yetkiniz yok.' });
    }
    setMemoryGames(nextGames);
    emitLobbyUpdate({
      action: 'game_deleted',
      gameId: id,
    });
    return res.json({ success: true });
  };

  return {
    getGames,
    createGame,
    joinGame,
    getGameState,
    getUserGameHistory,
    makeMove,
    drawOffer,
    resignGame,
    finishGame,
    deleteGame,
  };
};

module.exports = {
  createGameHandlers,
};
