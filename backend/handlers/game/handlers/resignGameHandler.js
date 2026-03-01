/**
 * Resign Game Handler
 * Handles game resignation with winner determination and settlement
 */

const {
  isAdminActor,
  findOpponentName,
} = require('../validation');
const { isChessGameType } = require('../chessUtils');
const { assertGameStatusTransition, assertRequiredGameStatus, GAME_STATUS } = require('../../../utils/gameStateMachine');
const { mapTransitionError } = require('../utils/errorHelpers');
const { applyDbSettlement, applyMemorySettlement } = require('../settlementUtils');

const createResignGameHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    getGameParticipants,
    gameService,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
    GAME_STATUS,
  } = deps;

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

        const winnerByResign = findOpponentName(actorParticipant, game, getGameParticipants);
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
          gameType: game.game_type,
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
    }, getGameParticipants);
    if (!winnerByResign) {
      return res.status(409).json({ error: 'Rakip bulunamadığı için teslim işlemi yapılamadı.' });
    }

    const resignTransition = assertGameStatusTransition({
      fromStatus: game.status,
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
      gameType: game.gameType,
      getMemoryUsers,
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

  return resignGame;
};

module.exports = { createResignGameHandler };
