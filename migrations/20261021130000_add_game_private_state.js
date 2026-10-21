/**
 * Private half of the server-authoritative game state.
 *
 * `games.game_state` stays the public, broadcastable view (current round,
 * revealed answers, scores). Answer keys, future questions, action receipts
 * and bot plans live here and are never selected by public queries.
 *
 * @type {import('node-pg-migrate').Migration}
 */
exports.up = (pgm) => {
  pgm.addColumn('games', {
    game_private_state: {
      type: 'jsonb',
      notNull: false,
      default: null,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('games', 'game_private_state');
};
