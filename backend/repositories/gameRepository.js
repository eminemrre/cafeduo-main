const createGameRepository = ({ pool, supportedGameTypes }) => {
  const findLatestActiveGameByUsername = async (username) => {
    const result = await pool.query(
      `
        SELECT
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          player1_move as "player1Move",
          player2_move as "player2Move",
          game_state as "gameState",
          created_at as "createdAt"
        FROM games
        WHERE (host_name = $1 OR guest_name = $1)
          AND status = 'active'
          AND game_type = ANY($2::text[])
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [username, [...supportedGameTypes]]
    );

    return result.rows[0] || null;
  };

  return {
    findLatestActiveGameByUsername,
  };
};

module.exports = {
  createGameRepository,
};

