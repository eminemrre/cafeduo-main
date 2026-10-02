const { executeDataMode, sendApiError, sendApiProblem } = require('../utils/routeHelpers');

const AVATAR_URL_PATTERN =
  /^https:\/\/api\.dicebear\.com\/9\.x\/pixel-art\/svg\?seed=[A-Za-z0-9_-]{1,32}$/;
const isValidAvatarUrl = (value) =>
  value === null || value === '' || (typeof value === 'string' && AVATAR_URL_PATTERN.test(value));
const USER_RETURNING_COLUMNS =
  'id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number, avatar_url';

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
          return sendApiError(
            res,
            logger,
            'Achievements fetch error',
            err,
            'Başarımlar yüklenemedi.'
          );
        }
      },
      memory: async () => res.json([]),
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
    const avatarUrlProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar_url');
    let nextAvatarUrl = null;
    if (avatarUrlProvided) {
      if (rawAvatarUrl === null || rawAvatarUrl === '') {
        nextAvatarUrl = null;
      } else if (isValidAvatarUrl(rawAvatarUrl)) {
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
          const setClauses = ['points = $1', 'wins = $2', 'games_played = $3', 'department = $4'];
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
             RETURNING ${USER_RETURNING_COLUMNS}`,
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

  // Profile edits must never carry an old game-statistics snapshot.
  const updateUserProfile = async (req, res) => {
    const body = req.body;
    const invalid = () =>
      sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Yalnızca bölüm veya avatar güncellenebilir.',
      });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid();
    const keys = Object.keys(body);
    if (!keys.length || keys.some((key) => !['department', 'avatar_url'].includes(key))) {
      return invalid();
    }
    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'department')) {
      if (typeof body.department !== 'string' || body.department.length > 120) return invalid();
      updates.department = body.department;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'avatar_url')) {
      if (!isValidAvatarUrl(body.avatar_url)) {
        return sendApiProblem(res, {
          status: 400,
          code: 'INVALID_AVATAR_URL',
          message: 'Avatar URL hatalı. Sadece curated DiceBear pixel-art avatarları kabul edilir.',
        });
      }
      updates.avatar_url = body.avatar_url || null;
    }
    const { id } = req.params;
    const notFound = () =>
      sendApiProblem(res, {
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          // Column names come exclusively from the validated allowlist above.
          const fields = Object.keys(updates);
          const params = fields.map((field) => updates[field]);
          params.push(id);
          const result = await pool.query(
            `UPDATE users SET ${fields.map((field, index) => `${field} = $${index + 1}`).join(', ')}
             WHERE id = $${params.length} RETURNING ${USER_RETURNING_COLUMNS}`,
            params
          );
          if (!result.rows.length) return notFound();
          const user = result.rows[0];
          if (user.cafe_id) {
            const cafe = await pool.query('SELECT name FROM cafes WHERE id = $1', [user.cafe_id]);
            if (cafe.rows.length) user.cafe_name = cafe.rows[0].name;
          }
          return res.json(user);
        } catch (error) {
          return sendApiError(
            res,
            logger,
            'User profile update error',
            error,
            'Kullanıcı güncellenemedi.'
          );
        }
      },
      memory: async () => {
        const users = getMemoryUsers();
        const index = users.findIndex((user) => Number(user.id) === Number(id));
        if (index === -1) return notFound();
        const nextUsers = [...users];
        nextUsers[index] = { ...users[index], ...updates };
        setMemoryUsers(nextUsers);
        return res.json(nextUsers[index]);
      },
    });
  };

  return {
    getLeaderboard,
    getAchievements,
    updateUserStats,
    updateUserProfile,
  };
};

module.exports = { createProfileHandlers };
