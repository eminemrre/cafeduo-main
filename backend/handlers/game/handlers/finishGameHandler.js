/**
 * Finish Game Handler
 * Handles game completion with winner determination and settlement
 */

const {
  isAdminActor,
} = require('../validation');
const { isChessGameType } = require('../chessUtils');
const {
  assertGameStatusTransition,
  normalizeGameStatus,
  GAME_STATUS,
} = require('../../../utils/gameStateMachine');
const { mapTransitionError } = require('../utils/errorHelpers');
const { applyDbSettlement, applyMemorySettlement } = require('../settlementUtils');

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
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
  } = deps;

  const finishGame = async (req, res) => {
    const { id } = req.params;
    const requestedWinner = req.body?.winner;
    const actorName = String(req.user?.username || '').trim();

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const game = gameService?.findGameByIdForUpdate
          ? await gameService.findGameByIdForUpdate(client, id)
          : null;

        if (!game) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Oyun bulunamadı.' });
        }
        const actorParticipant = depsNormalizeParticipantName(actorName, game);
        const adminActor = isAdminActor(req.user);
        if (!actorParticipant && !adminActor) {
          await client.query('ROLLBACK');
          return res.status(403).json({ error: 'Bu oyunu kapatma yetkin yok.' });
        }

        const participants = getGameParticipants(game);
        const stateResults =
          game.game_state && typeof game.game_state.results === 'object' ? game.game_state.results : {};
        const winnerFromState = depsNormalizeParticipantName(game.game_state?.resolvedWinner, game);
        const winnerFromResults = pickWinnerFromResults(stateResults, participants);
        const winnerFromRequest = depsNormalizeParticipantName(requestedWinner, game);
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

    const actorParticipant = depsNormalizeParticipantName(actorName, {
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
          gameType: game.gameType,
          getMemoryUsers,
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
