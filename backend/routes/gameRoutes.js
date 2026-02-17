const express = require('express');
const {
  validateGameIdParam,
  validateCreateGamePayload,
  validateJoinGamePayload,
  validateMovePayload,
} = require('../validators/gameValidators');

const createGameRoutes = ({
  authenticateToken,
  gameHandlers,
  gameService,
}) => {
  const router = express.Router();

  router.get('/games', authenticateToken, gameHandlers.getGames);
  router.post('/games', authenticateToken, validateCreateGamePayload, gameHandlers.createGame);
  router.post('/games/:id/join', authenticateToken, validateJoinGamePayload, gameHandlers.joinGame);
  router.get('/games/:id', authenticateToken, validateGameIdParam, gameHandlers.getGameState);
  router.post('/games/:id/move', authenticateToken, validateMovePayload, gameHandlers.makeMove);
  router.post('/games/:id/draw-offer', authenticateToken, validateGameIdParam, gameHandlers.drawOffer);
  router.post('/games/:id/resign', authenticateToken, validateGameIdParam, gameHandlers.resignGame);
  router.post('/games/:id/finish', authenticateToken, validateGameIdParam, gameHandlers.finishGame);
  router.delete('/games/:id', authenticateToken, validateGameIdParam, gameHandlers.deleteGame);
  router.get('/users/:username/game-history', authenticateToken, gameHandlers.getUserGameHistory);

  router.get('/users/:username/active-game', authenticateToken, async (req, res) => {
    const { username } = req.params;
    const actor = String(req.user?.username || '').trim().toLowerCase();
    const target = String(username || '').trim().toLowerCase();
    const isAdminActor = req.user?.role === 'admin' || req.user?.isAdmin === true;

    if (!isAdminActor && actor !== target) {
      return res.status(403).json({ error: 'Sadece kendi aktif oyununuzu görüntüleyebilirsiniz.' });
    }

    try {
      const activeGame = await gameService.getActiveGameForUser(username);
      return res.json(activeGame);
    } catch (err) {
      return res.status(500).json({ error: 'Aktif oyun sorgulanamadı.' });
    }
  });

  return router;
};

module.exports = {
  createGameRoutes,
};
