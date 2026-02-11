const { Chess } = require('chess.js');
const { GAME_STATUS } = require('../utils/gameStateMachine');

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
  mapTransitionError,
  sanitizeLiveSubmission,
  getGameParticipants,
  pickWinnerFromResults,
  sanitizeScoreSubmission,
  getMemoryGames,
  emitRealtimeUpdate,
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
    const baseMs = Math.max(60_000, Math.min(1_800_000, Math.floor(Number(source.baseMs || DEFAULT_CLOCK.baseMs))));
    const incrementMs = Math.max(0, Math.min(30_000, Math.floor(Number(source.incrementMs || DEFAULT_CLOCK.incrementMs))));

    const whiteMsRaw = Number(source.whiteMs);
    const blackMsRaw = Number(source.blackMs);
    const whiteMs = Number.isFinite(whiteMsRaw) ? Math.max(0, Math.floor(whiteMsRaw)) : baseMs;
    const blackMs = Number.isFinite(blackMsRaw) ? Math.max(0, Math.floor(blackMsRaw)) : baseMs;
    const lastTickAt = toIsoTime(source.lastTickAt) ? new Date(toIsoTime(source.lastTickAt)).toISOString() : null;
    const label = source.label ? String(source.label).slice(0, 32) : `${Math.round(baseMs / 60000)}+${Math.round(incrementMs / 1000)}`;

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
    const { player, move, gameState, scoreSubmission, chessMove, liveSubmission } = req.body || {};
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
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }

        const game = gameResult.rows[0];
        if (game.status === 'finished') {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun tamamlandı, hamle kabul edilmiyor.' });
        }

        const actorParticipant = normalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
        }

        const currentState = game.game_state && typeof game.game_state === 'object' ? game.game_state : {};

        if (chessMove) {
          if (!isChessGameType(game.game_type)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Bu oyun türü satranç hamlesi kabul etmiyor.' });
          }

          if (game.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Satranç hamlesi için oyun aktif olmalı.' });
          }

          const resolvedColor = adminActor
            ? (player === 'guest' ? 'b' : 'w')
            : resolveParticipantColor(actorParticipant, game);
          if (resolvedColor !== 'w' && resolvedColor !== 'b') {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu satranç oyunu için hamle yetkin yok.' });
          }

          const safeMove = sanitizeChessMovePayload(chessMove);
          if (!safeMove) {
            await client.query('ROLLBACK');
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
              gameState: timeoutState,
              timeout: true,
            });
          }

          if (chess.turn() !== resolvedColor) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Sıra sende değil.' });
          }

          const appliedMove = chess.move(safeMove);
          if (!appliedMove) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Yasadışı hamle.' });
          }

          const nextChessState = buildChessStateFromEngine(chess, currentChessState, appliedMove);
          const gameOver = nextChessState.isGameOver === true;
          const hostName = String(game.host_name || '').trim();
          const guestName = String(game.guest_name || '').trim();
          const winner =
            gameOver && nextChessState.result === 'checkmate'
              ? (resolvedColor === 'w' ? hostName : guestName)
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
          const chessTransition = assertGameStatusTransition({
            fromStatus: game.status,
            toStatus: nextStatus,
            context: 'chess_move',
          });
          if (!chessTransition.ok) {
            await client.query('ROLLBACK');
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
            gameState: nextState,
            status: nextStatus,
            winner: winner || null,
            move: {
              from: appliedMove.from,
              to: appliedMove.to,
              san: appliedMove.san,
            },
          });
        }

        if (liveSubmission) {
          if (game.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Canlı ilerleme bildirimi için oyun aktif olmalı.' });
          }
          if (!actorParticipant) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
          }

          const safeLive = sanitizeLiveSubmission(liveSubmission);
          if (safeLive.mode && safeLive.mode !== String(game.game_type || '').trim()) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Canlı ilerleme oyun türü eşleşmiyor.' });
          }

          const currentLive =
            currentState.live && typeof currentState.live === 'object' ? currentState.live : {};
          const currentSubmissions =
            currentLive.submissions && typeof currentLive.submissions === 'object'
              ? currentLive.submissions
              : {};

          const nextSubmissions = {
            ...currentSubmissions,
            [actorParticipant]: {
              ...(currentSubmissions[actorParticipant] || {}),
              ...safeLive,
            },
          };

          const participants = getGameParticipants(game);
          const resolvedWinner =
            participants.every((name) => Boolean(nextSubmissions[name]?.done))
              ? pickWinnerFromResults(nextSubmissions, participants)
              : null;

          const nextLiveState = {
            mode: safeLive.mode || String(game.game_type || '').trim(),
            submissions: nextSubmissions,
            ...(resolvedWinner ? { resolvedWinner } : {}),
            updatedAt: safeLive.updatedAt,
          };

          const nextState = {
            ...currentState,
            live: nextLiveState,
          };
          if (resolvedWinner) {
            nextState.resolvedWinner = resolvedWinner;
          }

          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(nextState), id]
          );

          await client.query('COMMIT');
          const waitingFor = participants.filter((name) => !nextSubmissions[name]?.done);
          emitRealtimeUpdate(id, {
            type: 'live_submission',
            gameId: id,
            live: nextLiveState,
            waitingFor,
            resolvedWinner: resolvedWinner || null,
          });
          return res.json({
            success: true,
            gameState: nextState,
            live: nextLiveState,
            waitingFor,
            resolvedWinner: resolvedWinner || null,
          });
        }

        if (scoreSubmission) {
          if (game.status !== 'active') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Skor gönderimi için oyun aktif olmalı.' });
          }

          if (!actorParticipant) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
          }

          const scorePayload =
            scoreSubmission && typeof scoreSubmission === 'object' ? scoreSubmission : {};

          const nextResults = {
            ...(currentState.results && typeof currentState.results === 'object' ? currentState.results : {}),
            [actorParticipant]: sanitizeScoreSubmission({
              ...scorePayload,
              username: actorName,
            }),
          };

          const participants = getGameParticipants(game);
          const resolvedWinner = pickWinnerFromResults(nextResults, participants);
          const nextState = {
            ...currentState,
            results: nextResults,
            ...(resolvedWinner ? { resolvedWinner } : {}),
          };

          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(nextState), id]
          );

          await client.query('COMMIT');
          emitRealtimeUpdate(id, {
            type: 'score_submission',
            gameId: id,
            gameState: nextState,
            resolvedWinner: resolvedWinner || null,
          });
          return res.json({
            success: true,
            gameState: nextState,
            resolvedWinner: resolvedWinner || null,
            waitingFor: participants.filter((name) => !nextResults[name]),
          });
        }

        if (gameState && typeof gameState === 'object') {
          const mergedState = {
            ...currentState,
            ...gameState,
          };

          if (currentState.results && !mergedState.results) {
            mergedState.results = currentState.results;
          }

          await client.query(
            `
              UPDATE games
              SET game_state = $1::jsonb
              WHERE id = $2
            `,
            [JSON.stringify(mergedState), id]
          );
          await client.query('COMMIT');
          emitRealtimeUpdate(id, {
            type: 'game_state',
            gameId: id,
            gameState: mergedState,
          });
          return res.json({ success: true, gameState: mergedState });
        }

        const hostName = String(game.host_name || '').trim().toLowerCase();
        const guestName = String(game.guest_name || '').trim().toLowerCase();
        const actorNormalized = String(actorParticipant || '').trim().toLowerCase();
        const resolvedPlayer = adminActor
          ? (player === 'guest' ? 'guest' : 'host')
          : actorNormalized === hostName
            ? 'host'
            : actorNormalized === guestName
              ? 'guest'
              : null;

        if (resolvedPlayer !== 'host' && resolvedPlayer !== 'guest') {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu hamleyi yapmaya yetkin yok.' });
        }

        const query =
          resolvedPlayer === 'host'
            ? 'UPDATE games SET player1_move = $1 WHERE id = $2'
            : 'UPDATE games SET player2_move = $1 WHERE id = $2';
        await client.query(query, [String(move || '').slice(0, 64), id]);
        await client.query('COMMIT');
        emitRealtimeUpdate(id, {
          type: 'legacy_move',
          gameId: id,
          player: resolvedPlayer,
          move: String(move || '').slice(0, 64),
        });
        return res.json({ success: true });
      } catch (err) {
        await client.query('ROLLBACK');
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
    if (game.status === 'finished') {
      return res.status(409).json({ error: 'Bu oyun tamamlandı, hamle kabul edilmiyor.' });
    }

    const actorParticipant = normalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const adminActor = isAdminActor(req.user);
    if (!actorParticipant && !adminActor) {
      return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
    }

    if (chessMove) {
      if (!isChessGameType(game.gameType)) {
        return res.status(400).json({ error: 'Bu oyun türü satranç hamlesi kabul etmiyor.' });
      }
      if (game.status !== 'active') {
        return res.status(409).json({ error: 'Satranç hamlesi için oyun aktif olmalı.' });
      }

      const resolvedColor = adminActor
        ? (player === 'guest' ? 'b' : 'w')
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
          resolvedColor === 'w' ? String(game.guestName || '').trim() : String(game.hostName || '').trim();
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

        emitRealtimeUpdate(id, {
          type: 'chess_state',
          gameId: id,
          status: game.status,
          winner: timeoutWinner || null,
          chess: game.gameState.chess,
        });
        return res.json({
          success: true,
          gameState: game.gameState,
          status: game.status,
          winner: timeoutWinner || null,
          timeout: true,
        });
      }

      if (chess.turn() !== resolvedColor) {
        return res.status(409).json({ error: 'Sıra sende değil.' });
      }

      const appliedMove = chess.move(safeMove);
      if (!appliedMove) {
        return res.status(400).json({ error: 'Yasadışı hamle.' });
      }

      const nextChessState = buildChessStateFromEngine(chess, currentChessState, appliedMove);
      const gameOver = nextChessState.isGameOver === true;
      const winner =
        gameOver && nextChessState.result === 'checkmate'
          ? (resolvedColor === 'w' ? String(game.hostName || '').trim() : String(game.guestName || '').trim())
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

    if (liveSubmission) {
      if (game.status !== 'active') {
        return res.status(409).json({ error: 'Canlı ilerleme bildirimi için oyun aktif olmalı.' });
      }
      if (!actorParticipant) {
        return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
      }

      const safeLive = sanitizeLiveSubmission(liveSubmission);
      if (safeLive.mode && safeLive.mode !== String(game.gameType || '').trim()) {
        return res.status(400).json({ error: 'Canlı ilerleme oyun türü eşleşmiyor.' });
      }

      const liveState =
        game.gameState?.live && typeof game.gameState.live === 'object' ? game.gameState.live : {};
      const currentSubmissions =
        liveState.submissions && typeof liveState.submissions === 'object'
          ? liveState.submissions
          : {};

      const nextSubmissions = {
        ...currentSubmissions,
        [actorParticipant]: {
          ...(currentSubmissions[actorParticipant] || {}),
          ...safeLive,
        },
      };
      const participants = getGameParticipants({
        host_name: game.hostName,
        guest_name: game.guestName,
      });
      const resolvedWinner =
        participants.every((name) => Boolean(nextSubmissions[name]?.done))
          ? pickWinnerFromResults(nextSubmissions, participants)
          : null;

      const nextLive = {
        mode: safeLive.mode || String(game.gameType || '').trim(),
        submissions: nextSubmissions,
        ...(resolvedWinner ? { resolvedWinner } : {}),
        updatedAt: safeLive.updatedAt,
      };

      game.gameState = {
        ...(game.gameState || {}),
        live: nextLive,
      };
      if (resolvedWinner) {
        game.gameState.resolvedWinner = resolvedWinner;
      }

      const waitingFor = participants.filter((name) => !nextSubmissions[name]?.done);
      emitRealtimeUpdate(id, {
        type: 'live_submission',
        gameId: id,
        live: nextLive,
        waitingFor,
        resolvedWinner: resolvedWinner || null,
      });
      return res.json({
        success: true,
        gameState: game.gameState,
        live: nextLive,
        waitingFor,
        resolvedWinner: resolvedWinner || null,
      });
    }

    if (scoreSubmission) {
      if (!actorParticipant) {
        return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
      }
      const canonicalParticipant = normalizeParticipantName(actorName, {
        host_name: game.hostName,
        guest_name: game.guestName,
      });
      if (!canonicalParticipant) {
        return res.status(403).json({ error: 'Bu oyunun oyuncusu değilsin.' });
      }
      game.gameState = game.gameState || {};
      game.gameState.results = game.gameState.results || {};
      game.gameState.results[canonicalParticipant] = sanitizeScoreSubmission({
        ...(typeof scoreSubmission === 'object' ? scoreSubmission : {}),
        username: actorName,
      });

      const participants = getGameParticipants({
        host_name: game.hostName,
        guest_name: game.guestName,
      });
      const resolvedWinner = pickWinnerFromResults(game.gameState.results, participants);
      if (resolvedWinner) {
        game.gameState.resolvedWinner = resolvedWinner;
      }

      emitRealtimeUpdate(id, {
        type: 'score_submission',
        gameId: id,
        gameState: game.gameState,
        resolvedWinner: resolvedWinner || null,
      });
      return res.json({
        success: true,
        gameState: game.gameState,
        resolvedWinner: resolvedWinner || null,
        waitingFor: participants.filter((name) => !game.gameState.results[name]),
      });
    }

    if (gameState && typeof gameState === 'object') {
      game.gameState = { ...(game.gameState || {}), ...gameState };
      emitRealtimeUpdate(id, {
        type: 'game_state',
        gameId: id,
        gameState: game.gameState,
      });
      return res.json({ success: true, gameState: game.gameState });
    }

    const hostName = String(game.hostName || '').trim().toLowerCase();
    const guestName = String(game.guestName || '').trim().toLowerCase();
    const actorNormalized = String(actorParticipant || '').trim().toLowerCase();
    const resolvedPlayer = adminActor
      ? (player === 'guest' ? 'guest' : 'host')
      : actorNormalized === hostName
        ? 'host'
        : actorNormalized === guestName
          ? 'guest'
          : null;
    if (resolvedPlayer === 'host') {
      game.player1Move = String(move || '').slice(0, 64);
    } else if (resolvedPlayer === 'guest') {
      game.player2Move = String(move || '').slice(0, 64);
    } else {
      return res.status(403).json({ error: 'Bu hamleyi yapmaya yetkin yok.' });
    }

    emitRealtimeUpdate(id, {
      type: 'legacy_move',
      gameId: id,
      player: resolvedPlayer,
      move: String(move || '').slice(0, 64),
    });
    return res.json({ success: true });
  };

  return {
    makeMove,
  };
};

module.exports = {
  createGameMoveService,
};
