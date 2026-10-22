/**
 * Finish Game Handler
 * Handles game completion with winner determination and settlement
 */

const { isAdminActor } = require('../validation');
const { isChessGameType } = require('../chessUtils');
const {
  assertGameStatusTransition,
  normalizeGameStatus,
  GAME_STATUS,
} = require('../../../utils/gameStateMachine');
const { mapTransitionError } = require('../utils/errorHelpers');
const { applyDbSettlement, applyMemorySettlement } = require('../settlementUtils');
const { rollbackQuietly } = require('../../../utils/transaction');
const { isCompetitiveEngineGameType } = require('../../../utils/gameEngineConfig');
const { syncCompetitiveGame } = require('../../../gameEngine/engineActions');
const { serializeGameForActor } = require('../../../gameEngine/gameView');
const { defaultRegistry } = require('../../../gameEngine/gameLock');
const { finalizeMemoryEngineGame, settleDbEngineGame } = require('../../../gameEngine/settlement');

const createFinishGameHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    getGameParticipants,
    normalizeParticipantName: depsNormalizeParticipantName,
    pickWinnerFromResults,
    gameService,
    getMemoryGames,
    setMemoryGames: _setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
  } = deps;

  const finishEngineFromDb = async ({ client, game, id, res }) => {
    const nowMs = Date.now();
    const sync = syncCompetitiveGame({ game, nowMs });
    const gameState = sync.changed
      ? { ...(game.game_state || {}), engine: sync.state }
      : game.game_state && typeof game.game_state === 'object'
        ? game.game_state
        : {};
    const engine = gameState.engine;
    if (!engine || engine.version !== 2) {
      await rollbackQuietly(client);
      return res.status(409).json({
        error: 'Bu oyun sunucu motoru durumu olmadan kapatılamaz.',
        code: 'ENGINE_STATE_MISSING',
      });
    }
    if (engine.phase !== 'finished') {
      await rollbackQuietly(client);
      return res.status(409).json({
        error: 'Sonuç henüz sunucu tarafından belirlenmedi.',
        code: 'SERVER_RESULT_PENDING',
      });
    }

    const settled = await settleDbEngineGame({
      client,
      game,
      gameState,
      privateState: game.game_private_state,
      logger,
      nowMs,
    });
    if (!settled.ok) {
      await rollbackQuietly(client);
      return res.status(409).json({
        error: 'Sonuç henüz sunucu tarafından belirlenmedi.',
        code: settled.code || 'SERVER_RESULT_PENDING',
      });
    }

    await client.query('COMMIT');
    const view = serializeGameForActor({
      ...game,
      game_state: settled.gameState,
      status: 'finished',
      winner: settled.winner,
    });
    emitRealtimeUpdate(id, {
      type: 'game_finished',
      gameId: id,
      status: 'finished',
      winner: settled.winner,
      draw: Boolean(engine.result?.draw),
      cancelled: Boolean(engine.result?.cancelled),
      reason: engine.result?.reason || 'rounds_complete',
      gameState: view.gameState,
    });
    return res.json({
      success: true,
      winner: settled.winner,
      draw: Boolean(engine.result?.draw),
      cancelled: Boolean(engine.result?.cancelled),
      settlementApplied: true,
      transferredPoints: settled.transferredPoints,
      game: view,
    });
  };

  const finishEngineFromMemory = async ({ id, res }) => {
    const outcome = await defaultRegistry.runExclusive(id, async () => {
      const game = getMemoryGames().find((item) => String(item.id) === String(id));
      if (!game) {
        return { status: 404, body: { error: 'Oyun bulunamadı.' } };
      }
      const engineBefore = game.gameState?.engine;
      if (!engineBefore || engineBefore.version !== 2) {
        return {
          status: 409,
          body: {
            error: 'Bu oyun sunucu motoru durumu olmadan kapatılamaz.',
            code: 'ENGINE_STATE_MISSING',
          },
        };
      }
      if (engineBefore.phase !== 'finished') {
        const advanced = syncCompetitiveGame({ game, nowMs: Date.now() });
        if (advanced.changed) {
          game.gameState = { ...(game.gameState || {}), engine: advanced.state };
          game.status = advanced.status || game.status;
          game.winner = advanced.winner || null;
        }
        if (advanced.state?.phase !== 'finished') {
          return {
            status: 409,
            body: {
              error: 'Sonuç henüz sunucu tarafından belirlenmedi.',
              code: 'SERVER_RESULT_PENDING',
            },
          };
        }
      }

      const finalized = finalizeMemoryEngineGame({
        game,
        privateState: game.gamePrivateState,
        getMemoryUsers,
        nowMs: Date.now(),
      });
      const engine = game.gameState?.engine;
      if (!engine?.result?.settled) {
        return {
          status: 409,
          body: {
            error: 'Sonuç henüz sunucu tarafından belirlenmedi.',
            code: 'SERVER_RESULT_PENDING',
          },
        };
      }

      const view = serializeGameForActor(game);
      if (finalized.changed) {
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: 'finished',
          winner: game.winner || null,
          draw: Boolean(engine.result?.draw),
          cancelled: Boolean(engine.result?.cancelled),
          reason: engine.result?.reason || 'rounds_complete',
          gameState: view.gameState,
        });
      }
      return {
        status: 200,
        body: {
          success: true,
          winner: game.winner || null,
          draw: Boolean(engine.result?.draw),
          cancelled: Boolean(engine.result?.cancelled),
          settlementApplied: true,
          transferredPoints: Number(engine.result?.transferredPoints || 0),
          game: view,
        },
      };
    });

    return res.status(outcome.status).json(outcome.body);
  };

  const finishGame = async (req, res) => {
    const { id } = req.params;
    const requestedWinner = req.body?.winner;
    const actorName = String(req.user?.username || '').trim();

    // A game result is derived by the server only. A client-supplied winner is
    // an old-protocol call: reject it explicitly instead of ignoring it, so a
    // stale client cannot believe it settled the match.
    if (
      requestedWinner !== undefined &&
      requestedWinner !== null &&
      String(requestedWinner).trim()
    ) {
      return res.status(410).json({
        error: 'Oyun sonucu istemciden belirlenemez. Lütfen sayfayı yenileyip tekrar dene.',
        code: 'LEGACY_PROTOCOL_DISABLED',
        field: 'winner',
      });
    }

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const game = gameService?.findGameByIdForUpdate
          ? await gameService.findGameByIdForUpdate(client, id)
          : null;

        if (!game) {
          await rollbackQuietly(client);
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }
        const actorParticipant = depsNormalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await rollbackQuietly(client);
          return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
        }

        if (isCompetitiveEngineGameType(game.game_type)) {
          return finishEngineFromDb({ client, game, id, res });
        }

        const participants = getGameParticipants(game);
        const stateResults =
          game.game_state && typeof game.game_state.results === 'object'
            ? game.game_state.results
            : {};
        const winnerFromState = depsNormalizeParticipantName(game.game_state?.resolvedWinner, game);
        const winnerFromResults = pickWinnerFromResults(stateResults, participants);
        const winnerFromRequest = depsNormalizeParticipantName(requestedWinner, game);
        const requestedWinnerRaw = String(requestedWinner || '').trim();
        const derivedWinner = winnerFromState || winnerFromResults;
        const manualWinnerAllowed = adminActor && Boolean(winnerFromRequest);
        const finalWinner = derivedWinner || (manualWinnerAllowed ? winnerFromRequest : null);
        const currentGameState =
          game.game_state && typeof game.game_state === 'object' ? { ...game.game_state } : {};
        const chessState =
          game.game_state && typeof game.game_state.chess === 'object'
            ? game.game_state.chess
            : null;
        const isChessDraw =
          isChessGameType(game.game_type) && Boolean(chessState?.isGameOver) && !finalWinner;
        const settlementAlreadyApplied = Boolean(currentGameState?.settlementApplied);

        if (requestedWinnerRaw && !winnerFromRequest && adminActor && !derivedWinner) {
          await rollbackQuietly(client);
          return res.status(400).json({ error: 'Geçersiz kazanan bilgisi.' });
        }

        if (!adminActor && requestedWinnerRaw && !derivedWinner) {
          await rollbackQuietly(client);
          return res.status(409).json({
            error: 'Sonuç henüz sunucu tarafından belirlenmedi. Önce tüm skorlar tamamlanmalı.',
            code: 'server_result_pending',
          });
        }

        if (!finalWinner && !isChessDraw && !manualWinnerAllowed) {
          await rollbackQuietly(client);
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
                gameType: game.game_type,
              });
              const patchedState = {
                ...currentGameState,
                settlementApplied: true,
                stakeTransferred: settlement.transferredPoints,
                settledAt: new Date().toISOString(),
              };
              if (gameService?.updateGameStateInDb) {
                await gameService.updateGameStateInDb(client, {
                  gameId: id,
                  gameState: patchedState,
                });
              }
              await client.query('COMMIT');
              // Emit so disconnected clients picking up later see the updated
              // stakeTransferred + settlementApplied flags.
              emitRealtimeUpdate(id, {
                type: 'game_finished',
                gameId: id,
                status: 'finished',
                winner: null,
                draw: true,
                gameState: patchedState,
              });
              return res.json({
                success: true,
                winner: null,
                alreadyFinished: true,
                draw: true,
                settlementApplied: true,
              });
            }
            await rollbackQuietly(client);
            return res.json({ success: true, winner: null, alreadyFinished: true, draw: true });
          }
          if (storedWinner.toLowerCase() === targetWinner.toLowerCase()) {
            if (!settlementAlreadyApplied) {
              const settlement = await applyDbSettlement({
                client,
                game,
                winnerName: game.winner || finalWinner,
                isDraw: false,
                gameType: game.game_type,
              });
              const patchedState = {
                ...currentGameState,
                settlementApplied: true,
                stakeTransferred: settlement.transferredPoints,
                settledAt: new Date().toISOString(),
              };
              if (gameService?.updateGameStateInDb) {
                await gameService.updateGameStateInDb(client, {
                  gameId: id,
                  gameState: patchedState,
                });
              }
              await client.query('COMMIT');
              // Same rationale as the chess-draw branch above: emit so any
              // peer that missed the original `game_finished` event picks up
              // the late settlement.
              emitRealtimeUpdate(id, {
                type: 'game_finished',
                gameId: id,
                status: 'finished',
                winner: game.winner || null,
                draw: false,
                gameState: patchedState,
              });
              return res.json({
                success: true,
                winner: game.winner || null,
                alreadyFinished: true,
                settlementApplied: true,
              });
            }
            await rollbackQuietly(client);
            return res.json({ success: true, winner: game.winner || null, alreadyFinished: true });
          }
          await rollbackQuietly(client);
          return res.status(409).json({ error: 'Oyun zaten farklı bir sonuçla tamamlandı.' });
        }

        const finishTransition = assertGameStatusTransition({
          fromStatus: game.status,
          toStatus: GAME_STATUS.FINISHED,
          context: 'finish_game',
        });
        if (!finishTransition.ok) {
          await rollbackQuietly(client);
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
          gameType: game.game_type,
        });
        nextGameState.settlementApplied = true;
        nextGameState.stakeTransferred = settlement.transferredPoints;
        nextGameState.settledAt = new Date().toISOString();

        if (gameService?.finishGameInDb) {
          await gameService.finishGameInDb(client, {
            gameId: id,
            winner: finalWinner || null,
            gameState: nextGameState,
          });
        }

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
        await rollbackQuietly(client);
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

    const actorParticipant = depsNormalizeParticipantName(actorName, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const adminActor = isAdminActor(req.user);
    if (!actorParticipant && !adminActor) {
      return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
    }

    if (isCompetitiveEngineGameType(game.gameType)) {
      return finishEngineFromMemory({ id, res });
    }

    const participants = getGameParticipants({
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const winnerFromState = depsNormalizeParticipantName(game.gameState?.resolvedWinner, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const winnerFromResults = pickWinnerFromResults(game.gameState?.results || {}, participants);
    const winnerFromRequest = depsNormalizeParticipantName(requestedWinner, {
      host_name: game.hostName,
      guest_name: game.guestName,
    });
    const requestedWinnerRaw = String(requestedWinner || '').trim();
    const derivedWinner = winnerFromState || winnerFromResults;
    const manualWinnerAllowed = adminActor && Boolean(winnerFromRequest);
    const finalWinner = derivedWinner || (manualWinnerAllowed ? winnerFromRequest : null);
    const isChessDraw =
      isChessGameType(game.gameType) && Boolean(game.gameState?.chess?.isGameOver) && !finalWinner;

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
      if (
        storedWinner.toLowerCase() !== targetWinner.toLowerCase() &&
        !(isChessDraw && !storedWinner && !targetWinner)
      ) {
        return res.status(409).json({ error: 'Oyun zaten farklı bir sonuçla tamamlandı.' });
      }
      if (!settlementAlreadyApplied) {
        const settlement = applyMemorySettlement({
          game,
          winnerName: finalWinner,
          isDraw: Boolean(isChessDraw),
          gameType: game.gameType,
          getMemoryUsers,
        });
        game.gameState = {
          ...(game.gameState || {}),
          settlementApplied: true,
          stakeTransferred: settlement.transferredPoints,
          settledAt: new Date().toISOString(),
        };
        // Mirror the DB path: emit after the late settlement so any peer that
        // already reconnected sees the updated gameState (stakeTransferred,
        // settledAt). Without this, a client that dropped before the first
        // emit will hold a stale UI until the next manual snapshot fetch.
        emitRealtimeUpdate(id, {
          type: 'game_finished',
          gameId: id,
          status: 'finished',
          winner: game.winner || finalWinner || null,
          draw: Boolean(isChessDraw),
          gameState: game.gameState,
        });
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
        gameType: game.gameType,
        getMemoryUsers,
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

  return finishGame;
};

module.exports = { createFinishGameHandler };
