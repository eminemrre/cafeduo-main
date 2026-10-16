/**
 * Game settlement utilities
 * Handles point transfers and statistics updates for finished games
 */

const { normalizeParticipantKey } = require('./validation/playerValidation');

const NON_COMPETITIVE_GAME_TYPES = new Set([]);

/**
 * Check if a game type is non-competitive (no point transfers)
 */
const isNonCompetitiveGameType = (gameType) =>
  NON_COMPETITIVE_GAME_TYPES.has(String(gameType || '').trim());

/**
 * Credit tournament points for an opted-in game:
 *   - Win  → 1.0 to the winner
 *   - Draw → 0.5 to each of the two participants
 *   - Loss → nothing (no row)
 *
 * Stake amount is ignored — this is a wins-based leaderboard. `points`
 * is NUMERIC(8,2) so half-points fit cleanly.
 *
 * Idempotent (UNIQUE(tournament_id, game_id, user_id) + ON CONFLICT DO
 * NOTHING). Failure is logged but never thrown — a tournament-credit hiccup
 * must not roll back the parent game-finish.
 */
const creditTournamentPoints = async ({
  client,
  game,
  participants,
  winnerName,
  isDraw,
  logger,
}) => {
  try {
    const tournamentId = Number(game?.tournament_id || game?.tournamentId || 0);
    if (!Number.isInteger(tournamentId) || tournamentId <= 0) return;

    const tournRes = await client.query(
      `SELECT id, status, cafe_id FROM tournaments WHERE id = $1`,
      [tournamentId]
    );
    if (tournRes.rows.length === 0) return;
    const tourn = tournRes.rows[0];
    if (tourn.status !== 'active') return;
    if (game?.cafe_id && Number(tourn.cafe_id) !== Number(game.cafe_id)) return;

    // Build the credit list: who gets what.
    const credits = [];
    const safeParticipants = Array.isArray(participants)
      ? participants.map((n) => String(n || '').trim()).filter(Boolean)
      : [];
    if (isDraw && safeParticipants.length === 2) {
      for (const name of safeParticipants) {
        credits.push({ username: name, points: 0.5 });
      }
    } else if (!isDraw) {
      const w = String(winnerName || '').trim();
      if (w) credits.push({ username: w, points: 1 });
    }
    if (credits.length === 0) return;

    const userRes = await client.query(
      `SELECT DISTINCT ON (LOWER(username)) id, username
       FROM users
       WHERE LOWER(username) = ANY($1::text[])`,
      [credits.map(({ username }) => normalizeParticipantKey(username))]
    );
    const userIds = new Map(
      userRes.rows.map((user) => [normalizeParticipantKey(user.username), user.id])
    );

    for (const { username, points } of credits) {
      const userId = userIds.get(normalizeParticipantKey(username));
      if (userId === undefined) continue;
      await client.query(
        `INSERT INTO tournament_points (tournament_id, user_id, game_id, points)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tournament_id, game_id, user_id) DO NOTHING`,
        [tournamentId, userId, game.id, points]
      );
    }
  } catch (err) {
    if (logger?.warn) {
      logger.warn('Tournament credit failed (non-fatal)', {
        error: err?.message || String(err),
        gameId: game?.id,
      });
    }
  }
};

/**
 * Apply database settlement for a finished game
 * Updates user points, wins, and games_played in the database
 */
const applyDbSettlement = async ({ client, game, winnerName, isDraw, gameType, logger }) => {
  const hostName = String(game.host_name || '').trim();
  const guestName = String(game.guest_name || '').trim();
  const participants = [hostName, guestName].filter(Boolean);
  if (participants.length === 0) {
    return { transferredPoints: 0 };
  }

  const uniqueLowerParticipants = Array.from(
    new Set(participants.map((name) => normalizeParticipantKey(name)).filter(Boolean))
  );

  const usersResult = await client.query(
    `
      SELECT id, username, points
      FROM users
      WHERE LOWER(username) = ANY($1::text[])
      FOR UPDATE
    `,
    [uniqueLowerParticipants]
  );

  const byUsername = new Map(
    usersResult.rows.map((row) => [normalizeParticipantKey(row.username), row])
  );

  const canonicalWinner = String(winnerName || '').trim();
  const winnerKey = normalizeParticipantKey(canonicalWinner);
  const stake = Math.max(0, Math.floor(Number(game.points || 0)));
  const nonCompetitive = isNonCompetitiveGameType(gameType || game.game_type);

  if (nonCompetitive) {
    for (const participantName of participants) {
      const user = byUsername.get(normalizeParticipantKey(participantName));
      if (!user) continue;
      await client.query(
        `
          UPDATE users
          SET games_played = games_played + 1
          WHERE id = $1
        `,
        [user.id]
      );
    }
    return { transferredPoints: 0 };
  }

  if (!isDraw && canonicalWinner && participants.length === 2) {
    const loserName = participants.find((name) => normalizeParticipantKey(name) !== winnerKey);
    const winnerUser = byUsername.get(winnerKey);
    const loserUser = loserName ? byUsername.get(normalizeParticipantKey(loserName)) : null;

    if (winnerUser) {
      const transferable = loserUser
        ? Math.min(stake, Math.max(0, Math.floor(Number(loserUser.points || 0))))
        : 0;
      await client.query(
        `
          UPDATE users
          SET points = points + $1,
              wins = wins + 1,
              games_played = games_played + 1
          WHERE id = $2
        `,
        [transferable, winnerUser.id]
      );

      if (loserUser) {
        await client.query(
          `
            UPDATE users
            SET points = GREATEST(points - $1, 0),
                games_played = games_played + 1
            WHERE id = $2
          `,
          [transferable, loserUser.id]
        );
      }

      // Tournament credit runs unconditionally at the bottom of
      // applyDbSettlement now — it picks the right credit (win=1, draw=0.5)
      // based on isDraw. Don't double-credit by calling here.
      await creditTournamentPoints({
        client,
        game,
        participants,
        winnerName: canonicalWinner,
        isDraw,
        logger,
      });
      return { transferredPoints: transferable };
    }
  }

  // Tournament credit for draws (and any non-competitive code path that
  // didn't return earlier with a winner credit). Win path already credited
  // above and returned, so we only reach here for draws / no-winner cases.
  await creditTournamentPoints({
    client,
    game,
    participants,
    winnerName: canonicalWinner,
    isDraw,
    logger,
  });

  for (const participantName of participants) {
    const user = byUsername.get(normalizeParticipantKey(participantName));
    if (!user) continue;
    const isWinner =
      !isDraw && canonicalWinner && normalizeParticipantKey(participantName) === winnerKey;
    await client.query(
      `
        UPDATE users
        SET games_played = games_played + 1,
            wins = wins + $1
        WHERE id = $2
      `,
      [isWinner ? 1 : 0, user.id]
    );
  }

  return { transferredPoints: 0 };
};

/**
 * Apply in-memory settlement for a finished game
 * Updates user points, wins, and games_played in memory
 */
const applyMemorySettlement = ({ game, winnerName, isDraw, gameType, getMemoryUsers }) => {
  const users = Array.isArray(getMemoryUsers?.()) ? getMemoryUsers() : [];
  const hostName = String(game.hostName || '').trim();
  const guestName = String(game.guestName || '').trim();
  const participants = [hostName, guestName].filter(Boolean);
  if (participants.length === 0) {
    return { transferredPoints: 0 };
  }

  const findUser = (username) =>
    users.find(
      (user) => normalizeParticipantKey(user?.username) === normalizeParticipantKey(username)
    );

  const canonicalWinner = String(winnerName || '').trim();
  const winnerKey = normalizeParticipantKey(canonicalWinner);
  const stake = Math.max(0, Math.floor(Number(game.points || 0)));
  const nonCompetitive = isNonCompetitiveGameType(gameType || game.gameType);

  if (nonCompetitive) {
    for (const participantName of participants) {
      const user = findUser(participantName);
      if (!user) continue;
      user.gamesPlayed = Math.max(0, Math.floor(Number(user.gamesPlayed || 0))) + 1;
    }
    return { transferredPoints: 0 };
  }

  if (!isDraw && canonicalWinner && participants.length === 2) {
    const loserName = participants.find((name) => normalizeParticipantKey(name) !== winnerKey);
    const winnerUser = findUser(canonicalWinner);
    const loserUser = loserName ? findUser(loserName) : null;

    if (winnerUser) {
      const transferable = loserUser
        ? Math.min(stake, Math.max(0, Math.floor(Number(loserUser.points || 0))))
        : 0;
      winnerUser.points = Math.max(0, Math.floor(Number(winnerUser.points || 0))) + transferable;
      winnerUser.wins = Math.max(0, Math.floor(Number(winnerUser.wins || 0))) + 1;
      winnerUser.gamesPlayed = Math.max(0, Math.floor(Number(winnerUser.gamesPlayed || 0))) + 1;
      if (loserUser) {
        loserUser.points = Math.max(0, Math.floor(Number(loserUser.points || 0)) - transferable);
        loserUser.gamesPlayed = Math.max(0, Math.floor(Number(loserUser.gamesPlayed || 0))) + 1;
      }
      return { transferredPoints: transferable };
    }
  }

  for (const participantName of participants) {
    const user = findUser(participantName);
    if (!user) continue;
    user.gamesPlayed = Math.max(0, Math.floor(Number(user.gamesPlayed || 0))) + 1;
    if (!isDraw && canonicalWinner && normalizeParticipantKey(participantName) === winnerKey) {
      user.wins = Math.max(0, Math.floor(Number(user.wins || 0))) + 1;
    }
  }

  return { transferredPoints: 0 };
};

/**
 * Map game state transition error to response format
 */
const mapTransitionError = (transitionResult) => ({
  error: transitionResult.message,
  code: transitionResult.code,
  fromStatus: transitionResult.from,
  toStatus: transitionResult.to,
});

module.exports = {
  NON_COMPETITIVE_GAME_TYPES,
  normalizeParticipantKey,
  isNonCompetitiveGameType,
  applyDbSettlement,
  applyMemorySettlement,
  mapTransitionError,
};
