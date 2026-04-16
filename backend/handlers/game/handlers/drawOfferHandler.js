/**
 * Draw Offer Handler
 * Handles chess draw offers (offer, accept, reject, cancel)
 */

const {
  isAdminActor,
  normalizeParticipantKey,
} = require('../validation');
const { isChessGameType, createInitialChessState } = require('../chessUtils');
const {
  assertGameStatusTransition,
  assertRequiredGameStatus,
  normalizeGameStatus,
  GAME_STATUS,
} = require('../../../utils/gameStateMachine');
const { mapTransitionError } = require('../utils/errorHelpers');
const { applyDbSettlement, applyMemorySettlement } = require('../settlementUtils');
const { normalizeDrawOfferAction, normalizeDrawOffer } = require('../drawOfferUtils');

const createDrawOfferHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    normalizeParticipantName,
    getMemoryGames,
    setMemoryGames,
    getMemoryUsers,
    emitRealtimeUpdate,
  } = deps;

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
          gameType: game.game_type,
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
      gameType: game.gameType,
      getMemoryUsers,
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

  return drawOffer;
};

module.exports = { createDrawOfferHandler };
