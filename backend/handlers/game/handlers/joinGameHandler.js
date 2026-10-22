/**
 * Join Game Handler
 * Handles joining an existing waiting game
 */

const { isAdminActor } = require('../validation');
const { isChessGameType, activateChessClockState } = require('../chessUtils');
const { assertGameStatusTransition } = require('../../../utils/gameStateMachine');
const { mapTransitionError } = require('../utils/errorHelpers');
const { rollbackQuietly } = require('../../../utils/transaction');
const {
  isCompetitiveEngineGameType,
  isGameEngineV2Enabled,
} = require('../../../utils/gameEngineConfig');
const { serializeGameForActor } = require('../../../gameEngine/gameView');
const {
  getEngine,
  isEnginePrivateStateReady,
  startEngineState,
} = require('../../../gameEngine/engines');

const maintenanceResponse = (res) =>
  res.status(503).json({
    error: 'Sıralı oyunlar sunucu doğrulamasına geçiyor. Kısa bir süre yeni maç açılamıyor.',
    code: 'GAME_ENGINE_MAINTENANCE',
  });

const createJoinGameHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    normalizeTableCode,
    normalizeParticipantName,
    gameService,
    lobbyCacheService,
    getMemoryGames,
    emitRealtimeUpdate,
    emitLobbyUpdate,
    GAME_STATUS,
  } = deps;

  const joinGame = async (req, res) => {
    const { id } = req.params;
    const guestName = String(req.user?.username || req.body?.guestName || '').trim();
    const adminActor = isAdminActor(req.user);
    const actorTableCode = normalizeTableCode(req.user?.table_number);
    const hasCheckIn = Boolean(req.user?.cafe_id) && Boolean(actorTableCode);

    if (!guestName) {
      return res.status(400).json({ error: 'guestName zorunludur.' });
    }
    if (!adminActor && !hasCheckIn) {
      return res
        .status(403)
        .json({ error: 'Oyuna katılmak için önce kafe check-in işlemi yapmalısın.' });
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
        // Old or new, no competitive game may be joined while the legacy
        // score protocol is the only one a deployed client understands.
        if (isCompetitiveEngineGameType(game.game_type) && !isGameEngineV2Enabled()) {
          await rollbackQuietly(client);
          return maintenanceResponse(res);
        }
        if (String(game.host_name || '').toLowerCase() === guestName.toLowerCase()) {
          await rollbackQuietly(client);
          return res.status(400).json({ error: 'Kendi oyununa katılamazsın.' });
        }

        if (game.status === 'finished') {
          const finishedJoinTransition = assertGameStatusTransition({
            fromStatus: game.status,
            toStatus: GAME_STATUS.ACTIVE,
            context: 'join_game',
          });
          await rollbackQuietly(client);
          return res.status(409).json(mapTransitionError(finishedJoinTransition));
        }

        const requiredStake = Math.max(0, Math.floor(Number(game.points || 0)));
        const actorPoints = Number(req.user?.points);
        if (!adminActor && Number.isFinite(actorPoints) && actorPoints < requiredStake) {
          await rollbackQuietly(client);
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
            return res.json({ success: true, game: serializeGameForActor(game) });
          }

          await rollbackQuietly(client);
          return res.status(409).json({ error: 'Oyun dolu.' });
        }

        const joinTransition = assertGameStatusTransition({
          fromStatus: game.status,
          toStatus: GAME_STATUS.ACTIVE,
          context: 'join_game',
        });
        if (!joinTransition.ok) {
          await rollbackQuietly(client);
          return res.status(409).json(mapTransitionError(joinTransition));
        }

        const playerBusy = gameService?.findActivePlayerConflict
          ? await gameService.findActivePlayerConflict(client, { gameId: id, username: guestName })
          : null;

        if (playerBusy) {
          await rollbackQuietly(client);
          return res.status(409).json({ error: 'Bu kullanıcı zaten aktif bir oyunda.' });
        }

        if (getEngine(game.game_type)) {
          if (!isEnginePrivateStateReady(game.game_type, game.game_private_state)) {
            await rollbackQuietly(client);
            return res.status(409).json({
              error: 'Bu oyun sunucu durumu olmadan başlatılamaz.',
              code: 'ENGINE_STATE_MISSING',
            });
          }
        }

        const nextGameState = (() => {
          const current =
            game.game_state && typeof game.game_state === 'object' ? { ...game.game_state } : {};
          if (isChessGameType(game.game_type)) {
            return {
              ...current,
              chess: activateChessClockState(current.chess),
            };
          }
          if (getEngine(game.game_type)) {
            return {
              ...current,
              engine: startEngineState({
                gameType: game.game_type,
                privateState: game.game_private_state,
                hostName: game.host_name,
                guestName,
                nowMs: Date.now(),
              }),
            };
          }
          return current;
        })();

        const joinedGame = gameService?.activateGameWithGuest
          ? await gameService.activateGameWithGuest(client, {
              gameId: id,
              guestName,
              gameState: nextGameState,
            })
          : null;

        if (!joinedGame) {
          await rollbackQuietly(client);
          return res.status(409).json({ error: 'Bu oyun artık katılıma uygun değil.' });
        }

        await client.query('COMMIT');

        // Cache invalidation - oyuna katılındı
        lobbyCacheService
          ?.onGameJoined({
            tableCode: joinedGame.table,
          })
          .catch((err) => {
            logger.warn(`Cache invalidation failed on game joined: ${err.message}`);
          });

        const joinedView = serializeGameForActor(joinedGame);
        emitRealtimeUpdate(joinedGame.id, {
          type: 'game_joined',
          gameId: joinedGame.id,
          status: joinedView.status,
          guestName: joinedView.guestName,
          gameState: joinedView.gameState || {},
          serverNow: joinedView.serverNow,
        });
        emitLobbyUpdate({
          action: 'game_joined',
          gameId: joinedGame.id,
          tableCode: joinedGame.table,
          status: joinedGame.status,
        });
        return res.json({ success: true, game: joinedView });
      } catch (err) {
        await rollbackQuietly(client);
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
    if (isCompetitiveEngineGameType(game.gameType) && !isGameEngineV2Enabled()) {
      return maintenanceResponse(res);
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
        return res.json({ success: true, game: serializeGameForActor(game) });
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

    if (getEngine(game.gameType)) {
      if (!isEnginePrivateStateReady(game.gameType, game.gamePrivateState)) {
        return res.status(409).json({
          error: 'Bu oyun sunucu durumu olmadan başlatılamaz.',
          code: 'ENGINE_STATE_MISSING',
        });
      }
    }

    game.status = 'active';
    game.guestName = guestName;
    if (isChessGameType(game.gameType)) {
      const current =
        game.gameState && typeof game.gameState === 'object' ? { ...game.gameState } : {};
      game.gameState = {
        ...current,
        chess: activateChessClockState(current.chess),
      };
    } else if (getEngine(game.gameType)) {
      const current =
        game.gameState && typeof game.gameState === 'object' ? { ...game.gameState } : {};
      game.gameState = {
        ...current,
        engine: startEngineState({
          gameType: game.gameType,
          privateState: game.gamePrivateState,
          hostName: game.hostName,
          guestName,
          nowMs: Date.now(),
        }),
      };
    }
    const joinedMemoryView = serializeGameForActor(game);
    emitRealtimeUpdate(game.id, {
      type: 'game_joined',
      gameId: game.id,
      status: joinedMemoryView.status,
      guestName: joinedMemoryView.guestName,
      gameState: joinedMemoryView.gameState || {},
    });
    emitLobbyUpdate({
      action: 'game_joined',
      gameId: game.id,
      tableCode: game.table,
      status: game.status,
    });
    return res.json({ success: true, game: serializeGameForActor(game) });
  };

  return joinGame;
};

module.exports = { createJoinGameHandler };
