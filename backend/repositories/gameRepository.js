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
    const {
      hostName,
      gameType,
      points,
      table,
      gameState,
      gamePrivateState = null,
      cafeId,
      tournamentId = null,
    } = params;
    // PR #36 — `cafe_id` recorded on every new game so per-cafe daily limits
    // and isolation queries don't need an extra join through users.
    //
    // Defensive fallback: production has been throwing 42703 'column
    // cafe_id of relation games does not exist' even though the column
    // is present in the schema dump. If the WITH cafe_id INSERT trips
    // 42703, retry without cafe_id. A SAVEPOINT around the first try
    // keeps the outer tx alive when the wrapped query fails — without
    // this, the very next query in the transaction dies with 25P02.
    const fullInsert = `
        INSERT INTO games (host_name, game_type, points, table_code, status, game_state, cafe_id, tournament_id, game_private_state)
        VALUES ($1, $2, $3, $4, 'waiting', $5::jsonb, $6, $7, $8::jsonb)
        RETURNING
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          game_state as "gameState",
          cafe_id as "cafeId",
          created_at as "createdAt",
          tournament_id as "tournamentId"
      `;
    const fallbackInsert = `
        INSERT INTO games (host_name, game_type, points, table_code, status, game_state, tournament_id, game_private_state)
        VALUES ($1, $2, $3, $4, 'waiting', $5::jsonb, $6, $7::jsonb)
        RETURNING
          id,
          host_name as "hostName",
          game_type as "gameType",
          points,
          table_code as "table",
          status,
          guest_name as "guestName",
          game_state as "gameState",
          NULL::int as "cafeId",
          created_at as "createdAt",
          tournament_id as "tournamentId"
      `;
    try {
      await client.query('SAVEPOINT game_insert_with_cafe');
      const result = await client.query(fullInsert, [
        hostName,
        gameType,
        points,
        table,
        JSON.stringify(gameState || {}),
        cafeId ?? null,
        tournamentId ?? null,
        gamePrivateState ? JSON.stringify(gamePrivateState) : null,
      ]);
      await client.query('RELEASE SAVEPOINT game_insert_with_cafe');
      return result.rows[0] || null;
    } catch (err) {
      // 42703 = undefined_column. The savepoint rolls back, but the
      // transaction itself stays alive thanks to the SAVEPOINT we set.
      try {
        await client.query('ROLLBACK TO SAVEPOINT game_insert_with_cafe');
      } catch {
        /* savepoint already gone */
      }
      if (!err || err.code !== '42703') {
        throw err;
      }
      const fallback = await client.query(fallbackInsert, [
        hostName,
        gameType,
        points,
        table,
        JSON.stringify(gameState || {}),
        tournamentId ?? null,
        gamePrivateState ? JSON.stringify(gamePrivateState) : null,
      ]);
      return fallback.rows[0] || null;
    }
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
          game_private_state,
          winner,
          created_at,
          to_jsonb(games)->>'cafe_id' AS cafe_id,
          to_jsonb(games)->>'tournament_id' AS tournament_id
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
            game_state = $3::jsonb,
            game_private_state = COALESCE($4::jsonb, game_private_state)
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
          game_private_state as "gamePrivateState",
          created_at as "createdAt"
      `,
      [
        guestName,
        gameId,
        JSON.stringify(gameState || {}),
        params.gamePrivateState ? JSON.stringify(params.gamePrivateState) : null,
      ]
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

  const updateEngineState = async (client, params) => {
    const { gameId, gameState, gamePrivateState, status, winner } = params;
    const result = await client.query(
      `
        UPDATE games
        SET game_state = $1::jsonb,
            game_private_state = $2::jsonb,
            status = COALESCE($3::text, status),
            winner = $4::text
        WHERE id = $5
        RETURNING id, status, winner
      `,
      [
        JSON.stringify(gameState || {}),
        gamePrivateState ? JSON.stringify(gamePrivateState) : null,
        status || null,
        winner || null,
        gameId,
      ]
    );
    return result.rows[0] || null;
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
    updateEngineState,
    updateGameState,
  };
};

module.exports = {
  createGameRepository,
};
