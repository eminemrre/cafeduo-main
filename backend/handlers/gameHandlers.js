const { Chess } = require('chess.js');
const {
  GAME_STATUS,
  assertGameStatusTransition,
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

  const isChessGameType = (gameType) => String(gameType || '').trim() === CHESS_GAME_TYPE;

  const createInitialChessState = () => {
    const chess = new Chess();
    return {
      version: 1,
      fen: chess.fen(),
      turn: chess.turn(),
      inCheck: false,
      isGameOver: false,
      result: null,
      moveHistory: [],
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
    return {
      mode,
      score: safeScore,
      roundsWon: safeRounds,
      round: safeRound,
      done,
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
          ? { chess: createInitialChessState() }
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
      gameState: isChessGameType(gameType) ? { chess: createInitialChessState() } : {},
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
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun zaten tamamlandı.' });
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

        const updatedResult = await client.query(
          `
            UPDATE games
            SET status = 'active',
                guest_name = $1
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
          [guestName, id]
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
      return res.status(409).json({ error: 'Bu oyun zaten tamamlandı.' });
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
    if (await isDbConnected()) {
      const result = await pool.query(
        `
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
      `,
        [id]
      );
      if (result.rows.length > 0) {
        return res.json(result.rows[0]);
      }
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = getMemoryGames().find((item) => String(item.id) === String(id));
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
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
    mapTransitionError,
    sanitizeLiveSubmission,
    getGameParticipants,
    pickWinnerFromResults,
    sanitizeScoreSubmission,
    getMemoryGames,
    emitRealtimeUpdate,
  });

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
            SELECT id, host_name, guest_name, status, winner, game_state
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
        const finalWinner = winnerFromState || winnerFromResults || winnerFromRequest;
        const chessState =
          game.game_state && typeof game.game_state.chess === 'object' ? game.game_state.chess : null;
        const isChessDraw =
          isChessGameType(game.game_type) &&
          Boolean(chessState?.isGameOver) &&
          !finalWinner;

        if (!finalWinner && !isChessDraw) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Kazanan belirlenemedi. Her iki oyuncu da skoru göndermeli.' });
        }

        if (game.status === 'finished') {
          await client.query('ROLLBACK');
          const storedWinner = String(game.winner || '').trim();
          const targetWinner = String(finalWinner || '').trim();
          if (!storedWinner && !targetWinner && isChessDraw) {
            return res.json({ success: true, winner: null, alreadyFinished: true, draw: true });
          }
          if (storedWinner.toLowerCase() === targetWinner.toLowerCase()) {
            return res.json({ success: true, winner: game.winner || null, alreadyFinished: true });
          }
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

        const nextGameState =
          game.game_state && typeof game.game_state === 'object'
            ? { ...game.game_state }
            : {};
        if (finalWinner) {
          nextGameState.resolvedWinner = finalWinner;
        } else if (nextGameState.resolvedWinner) {
          delete nextGameState.resolvedWinner;
        }

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
    const finalWinner = winnerFromState || winnerFromResults || winnerFromRequest;
    const isChessDraw =
      isChessGameType(game.gameType) &&
      Boolean(game.gameState?.chess?.isGameOver) &&
      !finalWinner;

    if (!finalWinner && !isChessDraw) {
      return res.status(409).json({ error: 'Kazanan belirlenemedi. Her iki oyuncu da skoru göndermeli.' });
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
    finishGame,
    deleteGame,
  };
};

module.exports = {
  createGameHandlers,
};
