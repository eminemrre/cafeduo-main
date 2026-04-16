const createGameService = ({
  isDbConnected,
  gameRepository,
  lobbyCacheService,
  getMemoryGames,
  getMemoryUsers,
  supportedGameTypes,
}) => {
  const listWaitingGames = async ({
    adminActor,
    hasCheckIn,
    actorCafeId,
    actorTableCode,
    requestedTableCode,
    scopeAllRequested,
  }) => {
    if (!adminActor && !hasCheckIn) {
      return [];
    }

    const effectiveTableCode = adminActor
      ? requestedTableCode
      : scopeAllRequested
        ? null
        : actorTableCode;

    if (await isDbConnected()) {
      const fetchWaitingGames = () => {
        if (!adminActor && scopeAllRequested) {
          return gameRepository.listWaitingGamesByCafe({ cafeId: actorCafeId });
        }
        if (effectiveTableCode) {
          return gameRepository.listWaitingGamesByTable({ tableCode: effectiveTableCode });
        }
        return gameRepository.listWaitingGames();
      };

      // Cache scope belirle
      let cacheScope = 'all';
      if (!adminActor && scopeAllRequested) {
        cacheScope = 'cafe';
      } else if (effectiveTableCode) {
        cacheScope = 'table';
      }

      if (!lobbyCacheService?.getWaitingGames) {
        return fetchWaitingGames();
      }

      // Cache ile oyunları getir
      return lobbyCacheService.getWaitingGames(
        { scope: cacheScope, tableCode: effectiveTableCode, cafeId: actorCafeId },
        fetchWaitingGames
      );
    }

    const memoryUsers = Array.isArray(getMemoryUsers?.()) ? getMemoryUsers() : [];
    return getMemoryGames().filter((game) => {
      if (String(game.status || '').toLowerCase() !== 'waiting') return false;
      if (!supportedGameTypes.has(String(game.gameType || '').trim())) return false;

      if (!adminActor && scopeAllRequested) {
        const hostName = String(game.hostName || '').trim().toLowerCase();
        const hostUser = memoryUsers.find(
          (user) => String(user?.username || '').trim().toLowerCase() === hostName
        );
        const hostCafeId = Number(hostUser?.cafe_id ?? hostUser?.cafeId ?? 0);
        if (hostCafeId !== actorCafeId) return false;
      }

      if (effectiveTableCode && String(game.table || '').trim().toUpperCase() !== effectiveTableCode) {
        return false;
      }

      return true;
    });
  };

  const getActiveGameForUser = async (username) => {
    if (await isDbConnected()) {
      return gameRepository.findLatestActiveGameByUsername(username);
    }

    const game = getMemoryGames().find(
      (item) =>
        (item.hostName === username || item.guestName === username) &&
        item.status === 'active' &&
        supportedGameTypes.has(String(item.gameType || '').trim())
    );

    return game || null;
  };

  const findParticipantPendingOrActiveGameForUpdate = async (client, username) =>
    gameRepository.findParticipantPendingOrActiveGameForUpdate(client, username);

  const insertWaitingGame = async (client, params) =>
    gameRepository.insertWaitingGame(client, params);

  const findGameByIdForUpdate = async (client, gameId) =>
    gameRepository.findGameByIdForUpdate(client, gameId);

  const findActivePlayerConflict = async (client, params) =>
    gameRepository.findActivePlayerConflict(client, params);

  const activateGameWithGuest = async (client, params) =>
    gameRepository.activateGameWithGuest(client, params);

  const finishGameInDb = async (client, params) =>
    gameRepository.finishGame(client, params);

  const updateGameStateInDb = async (client, params) =>
    gameRepository.updateGameState(client, params);

  return {
    listWaitingGames,
    getActiveGameForUser,
    findParticipantPendingOrActiveGameForUpdate,
    insertWaitingGame,
    findGameByIdForUpdate,
    findActivePlayerConflict,
    activateGameWithGuest,
    finishGameInDb,
    updateGameStateInDb,
  };
};

module.exports = {
  createGameService,
};
