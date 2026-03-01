/**
 * Join Game Handler
 * Handles joining an existing waiting game
 */

const {
  isAdminActor,
  normalizeParticipantName,
} = require('../validation');
const { isChessGameType, activateChessClockState } = require('../chessUtils');
const { assertGameStatusTransition, GAME_STATUS } = require('../../../utils/gameStateMachine');
const { mapTransitionError } = require('../utils/errorHelpers');

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
      return res.status(403).json({ error: 'Oyuna katılmak için önce kafe check-in işlemi yapmalısın.' });
    }

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

        const playerBusy = gameService?.findActivePlayerConflict
          ? await gameService.findActivePlayerConflict(client, { gameId: id, username: guestName })
          : null;

        if (playerBusy) {
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

        const joinedGame = gameService?.activateGameWithGuest
          ? await gameService.activateGameWithGuest(client, {
              gameId: id,
              guestName,
              gameState: nextGameState,
            })
          : null;

        if (!joinedGame) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Bu oyun artık katılıma uygun değil.' });
        }

        await client.query('COMMIT');
        
        // Cache invalidation - oyuna katılındı
        lobbyCacheService?.onGameJoined({
          tableCode: joinedGame.table,
        }).catch((err) => {
          logger.warn(`Cache invalidation failed on game joined: ${err.message}`);
        });
        
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
          tableCode: joinedGame.table,
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
      tableCode: game.table,
      status: game.status,
    });
    return res.json({ success: true, game });
  };

  return joinGame;
};

module.exports = { createJoinGameHandler };
