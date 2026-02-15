const createGameService = ({
  isDbConnected,
  gameRepository,
  getMemoryGames,
  supportedGameTypes,
}) => {
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

  return {
    getActiveGameForUser,
  };
};

module.exports = {
  createGameService,
};

