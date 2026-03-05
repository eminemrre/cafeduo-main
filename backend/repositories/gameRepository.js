const createGameRepository = ({ pool, supportedGameTypes }) => {
  const WAITING_GAMES_SELECT = `
    SELECT
      id,
      host_name as "hostName",
      game_type as "gameType",
      points,
      table_code as "table",
      status,
      guest_name as "guestName",
      created_at as "createdAt"
    FROM games
    WHERE status = 'waiting'
      AND game_type = ANY($1::text[])
  `;

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

  const listWaitingGamesByCafe = async ({ cafeId }) => {
    const result = await pool.query(
      `
        ${WAITING_GAMES_SELECT}
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE LOWER(u.username) = LOWER(games.host_name)
            AND u.cafe_id = $2
        )
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [[...supportedGameTypes], cafeId]
    );

    return result.rows;
  };

  const listWaitingGamesByTable = async ({ tableCode }) => {
    const result = await pool.query(
      `
        ${WAITING_GAMES_SELECT}
        AND table_code = $2
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [[...supportedGameTypes], tableCode]
    );

    return result.rows;
  };

  const listWaitingGames = async () => {
    const result = await pool.query(
      `
        ${WAITING_GAMES_SELECT}
        ORDER BY created_at DESC
        LIMIT 100
      `,
      [[...supportedGameTypes]]
    );

    return result.rows;
  };

  const findParticipantPendingOrActiveGameForUpdate = async (client, username) => {
    const result = await client.query(
      `
        SELECT
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          created_at as "createdAt"
        FROM games
        WHERE (host_name = $1 OR guest_name = $1)
          AND status IN ('waiting', 'active')
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `,
      [username]
    );

    return result.rows[0] || null;
  };

  const insertWaitingGame = async (client, params) => {
    const { hostName, gameType, points, table, gameState } = params;
    const result = await client.query(
      `
        INSERT INTO games (host_name, game_type, points, table_code, status, game_state)
        VALUES ($1, $2, $3, $4, 'waiting', $5::jsonb)
        RETURNING
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          game_state as "gameState",
          created_at as "createdAt"
      `,
      [hostName, gameType, points, table, JSON.stringify(gameState || {})]
    );

    return result.rows[0] || null;
  };

  const findGameByIdForUpdate = async (client, id) => {
    const result = await client.query(
      `
        SELECT
          id,
          host_name,
          game_type,
          points,
          table_code,
          status,
          guest_name,
          game_state,
          winner,
          created_at
        FROM games
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    return result.rows[0] || null;
  };

  const findActivePlayerConflict = async (client, params) => {
    const { gameId, username } = params;
    const result = await client.query(
      `
        SELECT id
        FROM games
        WHERE id <> $1
          AND status = 'active'
          AND (host_name = $2 OR guest_name = $2)
        LIMIT 1
      `,
      [gameId, username]
    );

    return result.rows[0] || null;
  };

  const activateGameWithGuest = async (client, params) => {
    const { gameId, guestName, gameState } = params;
    const result = await client.query(
      `
        UPDATE games
        SET status = 'active',
            guest_name = $1,
            game_state = $3::jsonb
        WHERE id = $2
          AND status = 'waiting'
        RETURNING
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          game_state as "gameState",
          created_at as "createdAt"
      `,
      [guestName, gameId, JSON.stringify(gameState || {})]
    );

    return result.rows[0] || null;
  };

  const finishGame = async (client, params) => {
    const { gameId, winner, gameState } = params;
    await client.query(
      `
        UPDATE games
        SET status = 'finished',
            winner = $1::text,
            game_state = $2::jsonb
        WHERE id = $3
      `,
      [winner || null, JSON.stringify(gameState || {}), gameId]
    );
  };

  const updateGameState = async (client, params) => {
    const { gameId, gameState } = params;
    await client.query(
      `
        UPDATE games
        SET game_state = $1::jsonb
        WHERE id = $2
      `,
      [JSON.stringify(gameState || {}), gameId]
    );
  };

  return {
    findLatestActiveGameByUsername,
    listWaitingGamesByCafe,
    listWaitingGamesByTable,
    listWaitingGames,
    findParticipantPendingOrActiveGameForUpdate,
    insertWaitingGame,
    findGameByIdForUpdate,
    findActivePlayerConflict,
    activateGameWithGuest,
    finishGame,
    updateGameState,
  };
};

module.exports = {
  createGameRepository,
};
