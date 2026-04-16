/**
 * Create Game Handler
 * Handles new game creation with validation and check-in requirements
 */

const { isAdminActor } = require('../validation');
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
            })
          : null;

        await client.query('COMMIT');
        if (!createdGame) {
          throw new Error('Created game could not be returned');
        }
        
        // Cache invalidation - oyun oluşturuldu
        lobbyCacheService?.onGameCreated({
          tableCode: table,
          cafeId: req.user?.cafe_id,
        }).catch((err) => {
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
      gameState: isChessGameType(gameType) ? { chess: createInitialChessState(req.body?.chessClock) } : {},
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
