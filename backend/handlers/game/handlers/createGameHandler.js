/**
 * Create Game Handler
 * Handles new game creation with validation and check-in requirements
 */

const { isAdminActor } = require('../validation');
const { sendApiError } = require('../../../utils/routeHelpers');
const { isChessGameType, createInitialChessState } = require('../chessUtils');

const createCreateGameHandler = (deps) => {
  const {
    pool,
    isDbConnected,
    logger,
    normalizeGameType,
    normalizeTableCode,
    gameService,
    lobbyCacheService,
    getMemoryGames,
    setMemoryGames,
    emitLobbyUpdate,
  } = deps;

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
      return res
        .status(403)
        .json({ error: 'Oyun kurmak için önce kafe check-in işlemi yapmalısın.' });
    }
    if (points > actorPoints && !adminActor) {
      return res.status(400).json({ error: 'Katılım puanı mevcut bakiyenden yüksek olamaz.' });
    }
    // Stake cap tightened to 150 in PR #36 (was 5000). Same value is mirrored
    // in backend/validators/gameValidators.js and CreateGameModal.tsx so the
    // form, validator, and handler all agree.
    if (points > 150) {
      return res.status(400).json({ error: 'Katılım puanı en fazla 150 olabilir.' });
    }

    const actorCafeId = req.user?.cafe_id ?? null;

    if (await isDbConnected()) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existingGame = gameService?.findParticipantPendingOrActiveGameForUpdate
          ? await gameService.findParticipantPendingOrActiveGameForUpdate(client, hostName)
          : (() => null)();

        if (existingGame) {
          await client.query('ROLLBACK');
          return res.status(409).json({
            error: 'Önce mevcut oyunu tamamla veya lobiye dön.',
            game: existingGame,
          });
        }

        // Per-cafe daily game cap (PR #36). Each cafe admin sets their own
        // `cafes.daily_game_limit`; users are limited to that many hosted
        // games per Turkish calendar day in that cafe. Super-admins are
        // exempt (`adminActor`). Cafe admins acting in their own panel
        // skip the check too — they manage, they don't compete.
        //
        // Soft-fail wrapper: production has been hitting "column
        // daily_game_limit does not exist" (42703) on this SELECT even
        // though the schema dump confirms the column is there. Cause
        // still unclear (cache? shadow table? old prepared statement?)
        // — soft-failing keeps users from being blocked while we diag.
        // Default behavior on failure: skip the daily-cap check entirely.
        if (!adminActor && actorCafeId) {
          // SAVEPOINT pattern: if the limit-lookup throws, just the
          // savepoint rolls back and the outer transaction stays usable.
          // Without this, a failed SELECT here aborts the transaction
          // and every subsequent query (including the INSERT) bails with
          // 25P02 'current transaction is aborted'.
          let limit = 0;
          try {
            await client.query('SAVEPOINT daily_limit_lookup');
            const limitRes = await client.query(
              `SELECT daily_game_limit FROM cafes WHERE id = $1`,
              [actorCafeId]
            );
            limit = Number(limitRes.rows[0]?.daily_game_limit ?? 10);
            await client.query('RELEASE SAVEPOINT daily_limit_lookup');
          } catch (limitErr) {
            try {
              await client.query('ROLLBACK TO SAVEPOINT daily_limit_lookup');
            } catch {
              /* savepoint already gone */
            }
            logger.warn('Daily game limit lookup failed (soft-fail)', {
              cafeId: actorCafeId,
              message: limitErr?.message,
              code: limitErr?.code,
            });
            limit = 0; // disable cap if we can't read it
          }
          if (Number.isFinite(limit) && limit > 0) {
            try {
              await client.query('SAVEPOINT daily_count_lookup');
              const countRes = await client.query(
                `SELECT COUNT(*)::int AS count FROM games
                   WHERE LOWER(host_name) = LOWER($1)
                     AND cafe_id = $2
                     AND status IN ('active', 'finished')
                     AND (created_at AT TIME ZONE 'Europe/Istanbul')::date
                       = (NOW() AT TIME ZONE 'Europe/Istanbul')::date`,
                [hostName, actorCafeId]
              );
              await client.query('RELEASE SAVEPOINT daily_count_lookup');
              const todaysGames = Number(countRes.rows[0]?.count ?? 0);
              if (todaysGames >= limit) {
                await client.query('ROLLBACK');
                return res.status(429).json({
                  error: `Bu kafede günlük oyun sınırına (${limit}) ulaştın. Yarın tekrar dene.`,
                  code: 'DAILY_GAME_LIMIT_REACHED',
                  limit,
                  played: todaysGames,
                });
              }
            } catch (countErr) {
              try {
                await client.query('ROLLBACK TO SAVEPOINT daily_count_lookup');
              } catch {
                /* savepoint already gone */
              }
              logger.warn('Daily game count lookup failed (soft-fail)', {
                cafeId: actorCafeId,
                message: countErr?.message,
                code: countErr?.code,
              });
              // continue without enforcing the cap
            }
          }
        }

        // Tournament opt-in. Host explicitly toggled "join active tournament"
        // in the create modal. Anything else (missing field, 0, negative,
        // non-active tournament) skips the tournament credit silently.
        let tournamentId = null;
        const rawTournamentId = Number(req.body?.tournamentId);
        if (Number.isInteger(rawTournamentId) && rawTournamentId > 0) {
          if (!actorCafeId) {
            await client.query('ROLLBACK');
            return res.status(400).json({
              error: 'Turnuvaya katılmak için bir kafede check-in olman gerekiyor.',
              code: 'TOURNAMENT_REQUIRES_CHECKIN',
            });
          }
          try {
            await client.query('SAVEPOINT tournament_lookup');
            const tournRes = await client.query(
              `SELECT id, game_type FROM tournaments
                WHERE id = $1 AND cafe_id = $2 AND status = 'active'
                  AND start_at <= now() AND end_at > now()`,
              [rawTournamentId, actorCafeId]
            );
            await client.query('RELEASE SAVEPOINT tournament_lookup');
            if (tournRes.rows.length === 0) {
              await client.query('ROLLBACK');
              return res.status(400).json({
                error: 'Bu turnuva şu an aktif değil veya kafenle eşleşmiyor.',
                code: 'TOURNAMENT_NOT_ACCEPTING_GAMES',
              });
            }
            const tourn = tournRes.rows[0];
            if (tourn.game_type && tourn.game_type !== gameType) {
              await client.query('ROLLBACK');
              return res.status(400).json({
                error: `Bu turnuva sadece ${tourn.game_type} oyunlarını kabul ediyor.`,
                code: 'TOURNAMENT_GAME_TYPE_MISMATCH',
              });
            }
            tournamentId = tourn.id;
          } catch (tourErr) {
            try {
              await client.query('ROLLBACK TO SAVEPOINT tournament_lookup');
            } catch {
              /* savepoint already gone */
            }
            // If the tournaments table doesn't exist yet (fresh DB pre-migration),
            // soft-fail: treat as no tournament. Real failure modes get logged.
            if (tourErr?.code !== '42P01') {
              logger.warn('Tournament lookup failed (soft-fail)', {
                message: tourErr?.message,
                code: tourErr?.code,
              });
            }
            tournamentId = null;
          }
        }

        const initialGameState = isChessGameType(gameType)
          ? { chess: createInitialChessState(req.body?.chessClock) }
          : {};

        const createdGame = gameService?.insertWaitingGame
          ? await gameService.insertWaitingGame(client, {
              hostName,
              gameType,
              points,
              table,
              gameState: initialGameState,
              cafeId: actorCafeId,
              tournamentId,
            })
          : null;

        await client.query('COMMIT');
        if (!createdGame) {
          throw new Error('Created game could not be returned');
        }

        // Cache invalidation - oyun oluşturuldu
        lobbyCacheService
          ?.onGameCreated({
            tableCode: table,
            cafeId: req.user?.cafe_id,
          })
          .catch((err) => {
            logger.warn(`Cache invalidation failed on game created: ${err.message}`);
          });

        emitLobbyUpdate({
          action: 'game_created',
          gameId: createdGame.id,
          tableCode: createdGame.table,
          status: createdGame.status,
        });
        return res.status(201).json(createdGame);
      } catch (err) {
        await client.query('ROLLBACK');
        return sendApiError(res, logger, 'Create game error', err, 'Oyun kurulamadı.');
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
      gameState: isChessGameType(gameType)
        ? { chess: createInitialChessState(req.body?.chessClock) }
        : {},
      createdAt: new Date().toISOString(),
    };
    const nextGames = [newGame, ...memoryGames];
    setMemoryGames(nextGames);
    emitLobbyUpdate({
      action: 'game_created',
      gameId: newGame.id,
      tableCode: newGame.table,
      status: newGame.status,
    });
    return res.status(201).json(newGame);
  };

  return createGame;
};

module.exports = { createCreateGameHandler };
