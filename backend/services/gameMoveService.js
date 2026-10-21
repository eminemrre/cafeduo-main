const { Chess } = require('chess.js');
const { GAME_STATUS } = require('../utils/gameStateMachine');
const { rollbackQuietly } = require('../utils/transaction');
const { serializeGameState } = require('../gameEngine/gameView');

const LEGACY_COMPETITIVE_FIELDS = ['liveSubmission', 'scoreSubmission', 'gameState', 'move'];

const findLegacyCompetitiveField = (body) => {
  if (!body || typeof body !== 'object') return null;
  return (
    LEGACY_COMPETITIVE_FIELDS.find((field) => body[field] !== undefined && body[field] !== null) ||
    null
  );
};

/**
 * The legacy protocol let a client write its own score, state or winner.
 * It must fail loudly instead of being silently ignored, so an old cached
 * client knows to refresh rather than believing its action was accepted.
 */
const legacyProtocolResponse = (res, field) =>
  res.status(410).json({
    error: 'Bu oyun isteği artık kabul edilmiyor. Lütfen sayfayı yenileyip tekrar dene.',
    code: 'LEGACY_PROTOCOL_DISABLED',
    field,
  });

const createGameMoveService = ({
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
  getMemoryGames,
  emitRealtimeUpdate,
  applyDbSettlement,
  applyMemorySettlement,
  getMemoryUsers,
}) => {
  const DEFAULT_CLOCK = Object.freeze({
    baseMs: 3 * 60 * 1000,
    incrementMs: 2 * 1000,
  });

  const toIsoTime = (input) => {
    const parsed = Date.parse(String(input || ''));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const normalizeClockState = (rawClock) => {
    const source = rawClock && typeof rawClock === 'object' ? rawClock : {};
    const baseMs = Math.max(
      60_000,
      Math.min(1_800_000, Math.floor(Number(source.baseMs || DEFAULT_CLOCK.baseMs)))
    );
    const incrementMs = Math.max(
      0,
      Math.min(30_000, Math.floor(Number(source.incrementMs || DEFAULT_CLOCK.incrementMs)))
    );

    const whiteMsRaw = Number(source.whiteMs);
    const blackMsRaw = Number(source.blackMs);
    const whiteMs = Number.isFinite(whiteMsRaw) ? Math.max(0, Math.floor(whiteMsRaw)) : baseMs;
    const blackMs = Number.isFinite(blackMsRaw) ? Math.max(0, Math.floor(blackMsRaw)) : baseMs;
    const lastTickAt = toIsoTime(source.lastTickAt)
      ? new Date(toIsoTime(source.lastTickAt)).toISOString()
      : null;
    const label = source.label
      ? String(source.label).slice(0, 32)
      : `${Math.round(baseMs / 60000)}+${Math.round(incrementMs / 1000)}`;

    return {
      baseMs,
      incrementMs,
      whiteMs,
      blackMs,
      lastTickAt,
      label,
    };
  };

  const applyElapsedToClock = (clockState, activeColor, nowMs) => {
    const key = activeColor === 'w' ? 'whiteMs' : 'blackMs';
    const activeBefore = Number(clockState[key] || 0);
    const startedAtMs = toIsoTime(clockState.lastTickAt);
    const elapsedMs =
      startedAtMs && nowMs > startedAtMs ? Math.max(0, Math.floor(nowMs - startedAtMs)) : 0;
    const remainingMs = Math.max(0, activeBefore - elapsedMs);
    return {
      key,
      elapsedMs,
      remainingMs,
    };
  };

  const makeMove = async (req, res) => {
    const { id } = req.params;
    const { player, chessMove } = req.body || {};
    const actorName = String(req.user?.username || '').trim();

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const gameResult = await client.query(
          `
            SELECT id, host_name, guest_name, game_type, status, game_state
            FROM games
            WHERE id = $1
            FOR UPDATE
          `,
          [id]
        );

        if (gameResult.rows.length === 0) {
          await rollbackQuietly(client);
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];

        const actorParticipant = normalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await rollbackQuietly(client);
          return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
        }

        const currentState =
          game.game_state && typeof game.game_state === 'object' ? game.game_state : {};

        const rejectedField = findLegacyCompetitiveField(req.body);
        if (rejectedField) {
          await rollbackQuietly(client);
          return legacyProtocolResponse(res, rejectedField);
        }

        if (chessMove) {
          if (!isChessGameType(game.game_type)) {
            await rollbackQuietly(client);
            return res.status(400).json({ error: 'Bu oyun türü satranç hamlesi kabul etmiyor.' });
          }

          const chessMoveStatus = assertRequiredGameStatus({
            currentStatus: game.status,
            requiredStatus: GAME_STATUS.ACTIVE,
            context: 'chess_move',
          });
          if (!chessMoveStatus.ok) {
            await rollbackQuietly(client);
            return res.status(409).json(mapTransitionError(chessMoveStatus));
          }

          const resolvedColor = adminActor
            ? player === 'guest'
              ? 'b'
              : 'w'
            : resolveParticipantColor(actorParticipant, game);
          if (resolvedColor !== 'w' && resolvedColor !== 'b') {
            await rollbackQuietly(client);
            return res.status(403).json({ error: 'Bu satranç oyunu için hamle yetkin yok.' });
          }

          const safeMove = sanitizeChessMovePayload(chessMove);
          if (!safeMove) {
            await rollbackQuietly(client);
            return res.status(400).json({ error: 'Geçersiz satranç hamlesi formatı.' });
          }

          const currentChessState =
            currentState.chess && typeof currentState.chess === 'object'
              ? currentState.chess
              : createInitialChessState();
          const normalizedClock = normalizeClockState(currentChessState.clock);
          const nowMs = Date.now();
          const nowIso = new Date(nowMs).toISOString();
          const elapsed = applyElapsedToClock(normalizedClock, resolvedColor, nowMs);

          let chess;
          try {
            chess = new Chess(String(currentChessState.fen || ''));
          } catch {
            chess = new Chess();
          }

          if (elapsed.remainingMs <= 0) {
            const hostName = String(game.host_name || '').trim();
            const guestName = String(game.guest_name || '').trim();
            const timeoutWinner = resolvedColor === 'w' ? guestName : hostName;

            const timeoutState = {
              ...currentState,
              chess: {
                ...buildChessStateFromEngine(chess, currentChessState, null),
                winner: timeoutWinner || null,
                result: 'timeout',
                isGameOver: true,
                timedOutColor: resolvedColor,
                clock: {
                  ...normalizedClock,
                  [elapsed.key]: 0,
                  lastTickAt: null,
                },
                updatedAt: nowIso,
              },
              ...(timeoutWinner ? { resolvedWinner: timeoutWinner } : {}),
            };

            // Apply settlement for timeout
            const settlementTimeout = await applyDbSettlement({
              client,
              game,
              winnerName: timeoutWinner,
              isDraw: false,
              gameType: game.game_type,
            });
            timeoutState.settlementApplied = true;
            timeoutState.stakeTransferred = settlementTimeout.transferredPoints;
            timeoutState.settledAt = nowIso;

            await client.query(
              `
                UPDATE games
                SET game_state = $1::jsonb,
                    status = 'finished',
                    winner = $2
                WHERE id = $3
              `,
              [JSON.stringify(timeoutState), timeoutWinner || null, id]
            );

            await client.query('COMMIT');
            emitRealtimeUpdate(id, {
              type: 'chess_state',
              gameId: id,
              status: 'finished',
              winner: timeoutWinner || null,
              chess: timeoutState.chess,
            });
            return res.json({
              success: true,
              status: 'finished',
              winner: timeoutWinner || null,
              gameState: serializeGameState('Retro Satranç', timeoutState),
              timeout: true,
            });
          }

          if (chess.turn() !== resolvedColor) {
            await rollbackQuietly(client);
            return res.status(409).json({ error: 'Sıra sende değil.' });
          }

          // chess.js v1 yasadışı hamlede null DÖNMEZ, Error FIRLATIR — yakalayıp
          // 400 dönmezsek dıştaki catch'e düşüp 500 veriyordu.
          let appliedMove;
          try {
            appliedMove = chess.move(safeMove);
          } catch {
            appliedMove = null;
          }
          if (!appliedMove) {
            await rollbackQuietly(client);
            return res.status(400).json({ error: 'Yasadışı hamle.' });
          }

          const nextChessState = buildChessStateFromEngine(chess, currentChessState, appliedMove);
          const gameOver = nextChessState.isGameOver === true;
          const hostName = String(game.host_name || '').trim();
          const guestName = String(game.guest_name || '').trim();
          const winner =
            gameOver && nextChessState.result === 'checkmate'
              ? resolvedColor === 'w'
                ? hostName
                : guestName
              : null;

          const incrementedRemaining = Math.min(
            3_600_000,
            elapsed.remainingMs + normalizedClock.incrementMs
          );
          const nextClock = {
            ...normalizedClock,
            [elapsed.key]: incrementedRemaining,
            lastTickAt: gameOver ? null : nowIso,
          };

          if (Array.isArray(nextChessState.moveHistory) && nextChessState.moveHistory.length > 0) {
            const latestMove = nextChessState.moveHistory[nextChessState.moveHistory.length - 1];
            nextChessState.moveHistory[nextChessState.moveHistory.length - 1] = {
              ...latestMove,
              spentMs: elapsed.elapsedMs,
              remainingMs: incrementedRemaining,
            };
          }
          nextChessState.clock = nextClock;
          nextChessState.updatedAt = nowIso;

          const nextState = {
            ...currentState,
            chess: {
              ...nextChessState,
              winner: winner || null,
            },
          };

          if (winner) {
            nextState.resolvedWinner = winner;
          } else if (gameOver && nextState.resolvedWinner) {
            delete nextState.resolvedWinner;
          }

          const nextStatus = gameOver ? 'finished' : 'active';

          // Apply settlement when chess game ends by checkmate or draw
          if (gameOver && applyDbSettlement) {
            const isDraw = !winner;
            const settlementCheckmate = await applyDbSettlement({
              client,
              game,
              winnerName: winner,
              isDraw,
              gameType: game.game_type,
            });
            nextState.settlementApplied = true;
            nextState.stakeTransferred = settlementCheckmate.transferredPoints;
            nextState.settledAt = new Date().toISOString();
          }
          const chessTransition = assertGameStatusTransition({
            fromStatus: game.status,
            toStatus: nextStatus,
            context: 'chess_move',
          });
          if (!chessTransition.ok) {
            await rollbackQuietly(client);
            return res.status(409).json(mapTransitionError(chessTransition));
          }
          const moveSan = String(appliedMove.san || '').slice(0, 64);
          const updateQuery =
            resolvedColor === 'w'
              ? `
                  UPDATE games
                  SET game_state = $1::jsonb,
                      status = $2,
                      winner = $3,
                      player1_move = $4
                  WHERE id = $5
                `
              : `
                  UPDATE games
                  SET game_state = $1::jsonb,
                      status = $2,
                      winner = $3,
                      player2_move = $4
                  WHERE id = $5
                `;

          await client.query(updateQuery, [
            JSON.stringify(nextState),
            nextStatus,
            winner || null,
            moveSan,
            id,
          ]);

          await client.query('COMMIT');
          emitRealtimeUpdate(id, {
            type: 'chess_state',
            gameId: id,
            status: nextStatus,
            winner: winner || null,
            chess: nextState.chess,
          });
          return res.json({
            success: true,
            gameState: serializeGameState('Retro Satranç', nextState),
            status: nextStatus,
            winner: winner || null,
            move: {
              from: appliedMove.from,
              to: appliedMove.to,
              san: appliedMove.san,
            },
          });
        }
      } catch (err) {
        await rollbackQuietly(client);
        logger.error('Game move update error', err);
        return res.status(500).json({ error: 'Hamle kaydedilemedi.' });
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
      return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
    }

    const rejectedField = findLegacyCompetitiveField(req.body);
    if (rejectedField) {
      return legacyProtocolResponse(res, rejectedField);
    }

    if (chessMove) {
      if (!isChessGameType(game.gameType)) {
        return res.status(400).json({ error: 'Bu oyun türü satranç hamlesi kabul etmiyor.' });
      }
      const chessMoveStatus = assertRequiredGameStatus({
        currentStatus: game.status,
        requiredStatus: GAME_STATUS.ACTIVE,
        context: 'chess_move_memory',
      });
      if (!chessMoveStatus.ok) {
        return res.status(409).json(mapTransitionError(chessMoveStatus));
      }

      const resolvedColor = adminActor
        ? player === 'guest'
          ? 'b'
          : 'w'
        : resolveParticipantColor(actorParticipant, {
            host_name: game.hostName,
            guest_name: game.guestName,
          });
      if (resolvedColor !== 'w' && resolvedColor !== 'b') {
        return res.status(403).json({ error: 'Bu satranç oyunu için hamle yetkin yok.' });
      }

      const safeMove = sanitizeChessMovePayload(chessMove);
      if (!safeMove) {
        return res.status(400).json({ error: 'Geçersiz satranç hamlesi formatı.' });
      }

      const currentChessState =
        game.gameState?.chess && typeof game.gameState.chess === 'object'
          ? game.gameState.chess
          : createInitialChessState();
      const normalizedClock = normalizeClockState(currentChessState.clock);
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const elapsed = applyElapsedToClock(normalizedClock, resolvedColor, nowMs);

      let chess;
      try {
        chess = new Chess(String(currentChessState.fen || ''));
      } catch {
        chess = new Chess();
      }

      if (elapsed.remainingMs <= 0) {
        const timeoutWinner =
          resolvedColor === 'w'
            ? String(game.guestName || '').trim()
            : String(game.hostName || '').trim();
        game.status = GAME_STATUS.FINISHED;
        game.winner = timeoutWinner || null;
        game.gameState = {
          ...(game.gameState || {}),
          chess: {
            ...buildChessStateFromEngine(chess, currentChessState, null),
            winner: timeoutWinner || null,
            result: 'timeout',
            isGameOver: true,
            timedOutColor: resolvedColor,
            clock: {
              ...normalizedClock,
              [elapsed.key]: 0,
              lastTickAt: null,
            },
            updatedAt: nowIso,
          },
          ...(timeoutWinner ? { resolvedWinner: timeoutWinner } : {}),
        };

        // Apply memory settlement for timeout
        if (applyMemorySettlement && getMemoryUsers) {
          const settlementMemTimeout = applyMemorySettlement({
            game,
            winnerName: timeoutWinner,
            isDraw: false,
            gameType: game.gameType,
            getMemoryUsers,
          });
          game.gameState.settlementApplied = true;
          game.gameState.stakeTransferred = settlementMemTimeout.transferredPoints;
          game.gameState.settledAt = nowIso;
        }

        emitRealtimeUpdate(id, {
          type: 'chess_state',
          gameId: id,
          status: game.status,
          winner: timeoutWinner || null,
          chess: game.gameState.chess,
        });
        return res.json({
          success: true,
          gameState: serializeGameState('Retro Satranç', game.gameState),
          status: game.status,
          winner: timeoutWinner || null,
          timeout: true,
        });
      }

      if (chess.turn() !== resolvedColor) {
        return res.status(409).json({ error: 'Sıra sende değil.' });
      }

      // chess.js v1 yasadışı hamlede Error fırlatır (null dönmez) — yakala, 400 dön.
      let appliedMove;
      try {
        appliedMove = chess.move(safeMove);
      } catch {
        appliedMove = null;
      }
      if (!appliedMove) {
        return res.status(400).json({ error: 'Yasadışı hamle.' });
      }

      const nextChessState = buildChessStateFromEngine(chess, currentChessState, appliedMove);
      const gameOver = nextChessState.isGameOver === true;
      const winner =
        gameOver && nextChessState.result === 'checkmate'
          ? resolvedColor === 'w'
            ? String(game.hostName || '').trim()
            : String(game.guestName || '').trim()
          : null;

      const incrementedRemaining = Math.min(
        3_600_000,
        elapsed.remainingMs + normalizedClock.incrementMs
      );
      const nextClock = {
        ...normalizedClock,
        [elapsed.key]: incrementedRemaining,
        lastTickAt: gameOver ? null : nowIso,
      };

      if (Array.isArray(nextChessState.moveHistory) && nextChessState.moveHistory.length > 0) {
        const latestMove = nextChessState.moveHistory[nextChessState.moveHistory.length - 1];
        nextChessState.moveHistory[nextChessState.moveHistory.length - 1] = {
          ...latestMove,
          spentMs: elapsed.elapsedMs,
          remainingMs: incrementedRemaining,
        };
      }
      nextChessState.clock = nextClock;
      nextChessState.updatedAt = nowIso;

      game.gameState = {
        ...(game.gameState || {}),
        chess: {
          ...nextChessState,
          winner: winner || null,
        },
      };
      if (winner) {
        game.gameState.resolvedWinner = winner;
      } else if (gameOver && game.gameState.resolvedWinner) {
        delete game.gameState.resolvedWinner;
      }

      if (resolvedColor === 'w') {
        game.player1Move = String(appliedMove.san || '').slice(0, 64);
      } else {
        game.player2Move = String(appliedMove.san || '').slice(0, 64);
      }

      const nextMemoryStatus = gameOver ? GAME_STATUS.FINISHED : GAME_STATUS.ACTIVE;
      const memoryChessTransition = assertGameStatusTransition({
        fromStatus: game.status,
        toStatus: nextMemoryStatus,
        context: 'chess_move_memory',
      });
      if (!memoryChessTransition.ok) {
        return res.status(409).json(mapTransitionError(memoryChessTransition));
      }
      game.status = nextMemoryStatus;
      if (winner || gameOver) {
        game.winner = winner || null;
      }

      // Apply memory settlement when chess game ends by checkmate or draw
      if (gameOver && applyMemorySettlement && getMemoryUsers) {
        const isDraw = !winner;
        const settlementMemCheckmate = applyMemorySettlement({
          game,
          winnerName: winner,
          isDraw,
          gameType: game.gameType,
          getMemoryUsers,
        });
        game.gameState.settlementApplied = true;
        game.gameState.stakeTransferred = settlementMemCheckmate.transferredPoints;
        game.gameState.settledAt = nowIso;
      }

      emitRealtimeUpdate(id, {
        type: 'chess_state',
        gameId: id,
        status: game.status,
        winner: winner || null,
        chess: game.gameState.chess,
      });
      return res.json({
        success: true,
        gameState: game.gameState,
        status: game.status,
        winner: winner || null,
        move: {
          from: appliedMove.from,
          to: appliedMove.to,
          san: appliedMove.san,
        },
      });
    }
  };

  return {
    makeMove,
  };
};

module.exports = {
  createGameMoveService,
};
