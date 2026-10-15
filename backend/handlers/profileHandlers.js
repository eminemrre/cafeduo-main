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
      const result = await pool.query(
        `
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
      `,
        [userId]
      );

      if (result.rows.length > 0 && result.rows[0].json_agg) {
        const unlockedAchievements = result.rows[0].json_agg;
        const totalPoints = unlockedAchievements.reduce(
          (sum, a) => sum + (a.points_reward || 0),
          0
        );

        if (totalPoints > 0) {
          await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [
            totalPoints,
            userId,
          ]);
          logger.info(
            `Achievements unlocked for user ${userId}: +${totalPoints} points ` +
              `(${unlockedAchievements.map((a) => a.title).join(', ')})`
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
          // Leaderboard is for end users only — admins and cafe_admins are
          // operators (super-admin emin3619, cafe manager iibfkantin, etc.)
          // and shouldn't compete in the rankings.
          let query =
            'SELECT id, username, points, wins, games_played as "gamesPlayed", department, avatar_url FROM users WHERE role = \'user\'';
          const params = [];

          if (type === 'department' && department) {
            query += ' AND department = $1';
            params.push(department);
          }

          query += ' ORDER BY points DESC LIMIT 50';
          const result = await pool.query(query, params);
          return res.json(result.rows);
        } catch (err) {
          return sendApiError(
            res,
            logger,
            'Leaderboard fetch error',
            err,
            'Liderlik tablosu yüklenemedi.'
          );
        }
      },
      memory: async () => {
        // Same role filter as the DB path so dev/test parity holds.
        let users = [...getMemoryUsers()].filter((user) => (user.role || 'user') === 'user');
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
    const { limit: rawLimit = '100', offset: rawOffset = '0' } = req.query || {};
    const limit = typeof rawLimit === 'string' && /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
    const offset = typeof rawOffset === 'string' && /^\d+$/.test(rawOffset) ? Number(rawOffset) : NaN;
    if (
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || offset > Number.MAX_SAFE_INTEGER - limit
    ) {
      return sendApiProblem(res, {
        status: 400,
        code: 'INVALID_PAGINATION',
        message: 'limit 1-100 arasında, offset ise negatif olmayan bir tam sayı olmalıdır.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `WITH page AS (
              SELECT id, title, description, icon, condition_type, condition_value, points_reward
              FROM achievements
              ORDER BY points_reward ASC, id ASC
              LIMIT $2 OFFSET $3
            )
            SELECT page.id, page.title, page.description, page.icon,
              page.condition_type, page.condition_value, page.points_reward,
              (ua.achievement_id IS NOT NULL) AS unlocked,
              ua.unlocked_at AS "unlockedAt"
            FROM page
            LEFT JOIN user_achievements ua ON ua.achievement_id = page.id AND ua.user_id = $1
            ORDER BY page.points_reward ASC, page.id ASC
            LIMIT $2`,
            [userId, limit, offset]
          );

          // A full final page is followed by one empty page, avoiding an unbounded count.
          return res.json({
            items: result.rows,
            nextOffset: result.rows.length === limit ? offset + limit : null,
          });
        } catch (err) {
          return sendApiError(
            res,
            logger,
            'Achievements fetch error',
            err,
            'Başarımlar yüklenemedi.'
          );
        }
      },
      memory: async () => res.json({ items: [], nextOffset: null }),
    });
  };

  const updateUserStats = async (req, res) => {
    const { id } = req.params;
    const { points, wins, gamesPlayed, avatar_url: rawAvatarUrl } = req.body || {};

    // Avatar comes from a curated set of DiceBear v9 pixel-art seeds.
    // The frontend builds these URLs via lib/avatars.ts. We accept null/empty
    // (reset to initials) or an https://api.dicebear.com/9.x/pixel-art/svg?seed=…
    // URL whose seed is alphanumeric / dash / underscore. Any other shape is
    // rejected so a hostile client can't store an arbitrary src= on every user.
    const AVATAR_URL_PATTERN = /^https:\/\/api\.dicebear\.com\/9\.x\/pixel-art\/svg\?seed=[A-Za-z0-9_-]{1,32}$/;
    const avatarUrlProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar_url');
    let nextAvatarUrl = null;
    if (avatarUrlProvided) {
      if (rawAvatarUrl === null || rawAvatarUrl === '') {
        nextAvatarUrl = null;
      } else if (typeof rawAvatarUrl === 'string' && AVATAR_URL_PATTERN.test(rawAvatarUrl)) {
        nextAvatarUrl = rawAvatarUrl;
      } else {
        return sendApiProblem(res, {
          status: 400,
          code: 'INVALID_AVATAR_URL',
          message: 'Avatar URL hatalı. Sadece curated DiceBear pixel-art avatarları kabul edilir.',
        });
      }
    }
    const nextPoints = Math.floor(Number(points));
    const nextWins = Math.floor(Number(wins));
    const nextGamesPlayed = Math.floor(Number(gamesPlayed));
    const safeDepartment = String(req.body?.department || '').slice(0, 120);

    if (
      ![nextPoints, nextWins, nextGamesPlayed].every(
        (value) => Number.isFinite(value) && value >= 0
      )
    ) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Puan, galibiyet ve oyun sayısı geçerli pozitif sayılar olmalıdır.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          // Build SET clause dynamically so avatar_url only updates when supplied —
          // otherwise calling PUT /users/:id from the stats path would clobber a
          // user's avatar to NULL on every game finish.
          const setClauses = [
            'points = $1',
            'wins = $2',
            'games_played = $3',
            'department = $4',
          ];
          const params = [nextPoints, nextWins, nextGamesPlayed, safeDepartment];
          if (avatarUrlProvided) {
            params.push(nextAvatarUrl);
            setClauses.push(`avatar_url = $${params.length}`);
          }
          params.push(id);
          const result = await pool.query(
            `UPDATE users
             SET ${setClauses.join(', ')}
             WHERE id = $${params.length}
             RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number, avatar_url`,
            params
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
            const cafeRes = await pool.query('SELECT name FROM cafes WHERE id = $1', [
              user.cafe_id,
            ]);
            if (cafeRes.rows.length > 0) {
              user.cafe_name = cafeRes.rows[0].name;
            }
          }

          // Fire-and-forget keeps response latency low.
          void checkAchievements(id);

          return res.json(user);
        } catch (err) {
          return sendApiError(
            res,
            logger,
            'User profile update error',
            err,
            'Kullanıcı güncellenemedi.'
          );
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
          ...(avatarUrlProvided ? { avatar_url: nextAvatarUrl } : {}),
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
