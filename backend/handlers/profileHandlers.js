const { executeDataMode, sendApiError } = require('../utils/routeHelpers');

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
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) return;
      const user = userRes.rows[0];

      const achievementsRes = await pool.query('SELECT * FROM achievements');
      const achievements = achievementsRes.rows;

      for (const achievement of achievements) {
        let qualified = false;
        if (achievement.condition_type === 'points' && user.points >= achievement.condition_value) qualified = true;
        if (achievement.condition_type === 'wins' && user.wins >= achievement.condition_value) qualified = true;
        if (achievement.condition_type === 'games_played' && user.games_played >= achievement.condition_value) qualified = true;

        if (!qualified) continue;

        const insertRes = await pool.query(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
          [userId, achievement.id]
        );

        if (insertRes.rows.length > 0) {
          await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [achievement.points_reward, userId]);
          logger.info(
            `Achievement unlocked: ${user.username} - ${achievement.title} (+${achievement.points_reward} pts)`
          );
        }
      }
    } catch (err) {
      logger.error('Achievement check error:', err);
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
          const allAchievements = await pool.query('SELECT * FROM achievements ORDER BY points_reward ASC');
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
      return res.status(400).json({ error: 'Puan, galibiyet ve oyun sayısı geçerli pozitif sayılar olmalıdır.' });
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
            return res.status(404).json({ error: 'User not found' });
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
          return res.status(404).json({ error: 'User not found' });
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
