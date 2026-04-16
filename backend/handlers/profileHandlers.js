const { executeDataMode, sendApiError, sendApiProblem } = require('../utils/routeHelpers');

const createProfileHandlers = ({
  pool,
  isDbConnected,
  logger,
  getMemoryUsers = () => [],
  setMemoryUsers = () => {},
}) => {
  const checkAchievements = async (userId) => {
    if (!(await isDbConnected())) return;

    try {
      // Single query with CTE to compute eligible achievements and unlock them
      // This replaces the N+1 pattern (1 + N*2 queries) with just 2 queries
      const result = await pool.query(`
        WITH user_stats AS (
          SELECT id, username, points, wins, games_played
          FROM users WHERE id = $1
        ),
        eligible AS (
          SELECT a.id, a.title, a.points_reward
          FROM achievements a, user_stats u
          WHERE (
            (a.condition_type = 'points' AND u.points >= a.condition_value) OR
            (a.condition_type = 'wins' AND u.wins >= a.condition_value) OR
            (a.condition_type = 'games_played' AND u.games_played >= a.condition_value)
          )
          AND NOT EXISTS (
            SELECT 1 FROM user_achievements ua
            WHERE ua.user_id = u.id AND ua.achievement_id = a.id
          )
        )
        INSERT INTO user_achievements (user_id, achievement_id)
        SELECT $1, id FROM eligible
        ON CONFLICT DO NOTHING
        RETURNING (SELECT json_agg(json_build_object('id', id, 'title', title, 'points_reward', points_reward)) FROM eligible)
      `, [userId]);

      if (result.rows.length > 0 && result.rows[0].json_agg) {
        const unlockedAchievements = result.rows[0].json_agg;
        const totalPoints = unlockedAchievements.reduce((sum, a) => sum + (a.points_reward || 0), 0);
        
        if (totalPoints > 0) {
          await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [totalPoints, userId]);
          logger.info(
            `Achievements unlocked for user ${userId}: +${totalPoints} points ` +
            `(${unlockedAchievements.map(a => a.title).join(', ')})`
          );
        }
      }
    } catch (err) {
      logger.error('Achievement check error:', err);
      // Re-throw for monitoring/alerting (but don't break user flow)
      // throw err; // Uncomment for stricter error handling
    }
  };

  const getLeaderboard = async (req, res) => {
    const { type, department } = req.query;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          let query = 'SELECT id, username, points, wins, games_played as "gamesPlayed", department FROM users';
          const params = [];

          if (type === 'department' && department) {
            query += ' WHERE department = $1';
            params.push(department);
          }

          query += ' ORDER BY points DESC LIMIT 50';
          const result = await pool.query(query, params);
          return res.json(result.rows);
        } catch (err) {
          return sendApiError(res, logger, 'Leaderboard fetch error', err, 'Liderlik tablosu yüklenemedi.');
        }
      },
      memory: async () => {
        let users = [...getMemoryUsers()];
        if (type === 'department' && department) {
          users = users.filter((user) => user.department === department);
        }
        users.sort((a, b) => Number(b.points || 0) - Number(a.points || 0));
        return res.json(users.slice(0, 50));
      },
    });
  };

  const getAchievements = async (req, res) => {
    const { userId } = req.params;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const allAchievements = await pool.query(
            'SELECT id, title, description, condition_type, condition_value, points_reward FROM achievements ORDER BY points_reward ASC'
          );
          const userUnlocked = await pool.query(
            'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1',
            [userId]
          );

          const unlockedMap = new Map();
          userUnlocked.rows.forEach((row) => unlockedMap.set(row.achievement_id, row.unlocked_at));

          const result = allAchievements.rows.map((achievement) => ({
            ...achievement,
            unlocked: unlockedMap.has(achievement.id),
            unlockedAt: unlockedMap.get(achievement.id) || null,
          }));

          return res.json(result);
        } catch (err) {
          return sendApiError(res, logger, 'Achievements fetch error', err, 'Başarımlar yüklenemedi.');
        }
      },
      memory: async () => res.json([]),
    });
  };

  const updateUserStats = async (req, res) => {
    const { id } = req.params;
    const { points, wins, gamesPlayed } = req.body || {};
    const nextPoints = Math.floor(Number(points));
    const nextWins = Math.floor(Number(wins));
    const nextGamesPlayed = Math.floor(Number(gamesPlayed));
    const safeDepartment = String(req.body?.department || '').slice(0, 120);

    if (![nextPoints, nextWins, nextGamesPlayed].every((value) => Number.isFinite(value) && value >= 0)) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Puan, galibiyet ve oyun sayısı geçerli pozitif sayılar olmalıdır.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `UPDATE users
             SET points = $1, wins = $2, games_played = $3, department = $4
             WHERE id = $5
             RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number, avatar_url`,
            [nextPoints, nextWins, nextGamesPlayed, safeDepartment, id]
          );

          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            });
          }

          const user = result.rows[0];

          if (user.cafe_id) {
            const cafeRes = await pool.query('SELECT name FROM cafes WHERE id = $1', [user.cafe_id]);
            if (cafeRes.rows.length > 0) {
              user.cafe_name = cafeRes.rows[0].name;
            }
          }

          // Fire-and-forget keeps response latency low.
          void checkAchievements(id);

          return res.json(user);
        } catch (err) {
          return sendApiError(res, logger, 'User profile update error', err, 'Kullanıcı güncellenemedi.');
        }
      },
      memory: async () => {
        const users = getMemoryUsers();
        const idx = users.findIndex((user) => Number(user.id) === Number(id));
        if (idx === -1) {
          return sendApiProblem(res, {
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        const nextUsers = [...users];
        nextUsers[idx] = {
          ...nextUsers[idx],
          points: nextPoints,
          wins: nextWins,
          gamesPlayed: nextGamesPlayed,
          department: safeDepartment,
        };
        setMemoryUsers(nextUsers);

        return res.json(nextUsers[idx]);
      },
    });
  };

  return {
    getLeaderboard,
    getAchievements,
    updateUserStats,
  };
};

module.exports = { createProfileHandlers };
