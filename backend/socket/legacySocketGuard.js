/**
 * Legacy Socket.IO game actions are closed.
 *
 * A room member used to be able to send any object and have the server
 * re-emit it as `game_state_updated` or `opponent_move`. That let a client
 * push a fabricated score/winner into the opponent's UI without touching the
 * database. Sockets now only carry server notifications; player actions go
 * through authenticated HTTP endpoints.
 */

const rejectLegacySocketAction = ({ socket, eventName, data, normalizeGameId, logger }) => {
  const gameId = normalizeGameId ? normalizeGameId(data?.gameId) : null;

  socket.emit('game_room_error', {
    code: 'LEGACY_PROTOCOL_DISABLED',
    event: eventName,
    ...(gameId ? { gameId } : {}),
  });

  logger?.warn?.('Blocked legacy socket game action', {
    socketId: socket.id,
    userId: socket.userId,
    gameId,
    eventName,
  });
};

module.exports = {
  rejectLegacySocketAction,
};
