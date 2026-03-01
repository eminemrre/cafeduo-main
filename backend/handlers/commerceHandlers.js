const crypto = require('crypto');
const { executeDataMode, sendApiError, sendApiProblem } = require('../utils/routeHelpers');

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const BASELINE_REWARDS = [
  { id: 9001, title: 'Bedava Filtre Kahve', cost: 500, description: 'Günün yorgunluğunu at.', icon: 'coffee' },
  { id: 9002, title: '%20 Hesap İndirimi', cost: 850, description: 'Tüm masada geçerli.', icon: 'discount' },
  { id: 9003, title: 'Cheesecake İkramı', cost: 400, description: 'Tatlı bir mola ver.', icon: 'dessert' },
  { id: 9004, title: 'Oyun Jetonu x5', cost: 100, description: 'Ekstra oyun hakkı.', icon: 'game' },
];

const createCommerceHandlers = ({
  pool,
  isDbConnected,
  logger,
  getMemoryItems,
  getMemoryRewards,
  getMemoryUsers = () => [],
  setMemoryUsers = () => {},
}) => {
  const ensureActiveRewardsDb = async () => {
    const activeRewardsResult = await pool.query('SELECT COUNT(*) FROM rewards WHERE is_active = true');
    if (Number(activeRewardsResult.rows?.[0]?.count || 0) > 0) {
      return;
    }

    await pool.query(`
      INSERT INTO rewards (title, cost, description, icon, is_active)
      VALUES
        ('Bedava Filtre Kahve', 500, 'Günün yorgunluğunu at.', 'coffee', true),
        ('%20 Hesap İndirimi', 850, 'Tüm masada geçerli.', 'discount', true),
        ('Cheesecake İkramı', 400, 'Tatlı bir mola ver.', 'dessert', true),
        ('Oyun Jetonu x5', 100, 'Ekstra oyun hakkı.', 'game', true)
    `);
    logger.warn('No active rewards remained. Baseline rewards were re-seeded.');
  };

  const createReward = async (req, res) => {
    const { title, cost, description, icon, cafeId } = req.body || {};

    if (!title || !cost) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Başlık ve maliyet zorunludur.',
      });
    }

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `INSERT INTO rewards (title, cost, description, icon, cafe_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, title, cost, description, icon, cafe_id, is_active, created_at`,
            [title, cost, description || '', icon || 'coffee', cafeId || null]
          );
          return res.json({ success: true, reward: result.rows[0] });
        } catch (err) {
          return sendApiError(res, logger, 'Reward creation error', err, 'Ödül oluşturulamadı.');
        }
      },
      memory: async () =>
        sendApiProblem(res, {
          status: 501,
          code: 'NOT_IMPLEMENTED',
          message: 'Demo modda ödül oluşturulamaz.',
        }),
    });
  };

  const getRewards = async (req, res) => {
    const { cafeId } = req.query;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          await ensureActiveRewardsDb();

          let query = 'SELECT id, title, description, cost, icon, cafe_id, is_active, created_at FROM rewards WHERE is_active = true';
          const params = [];

          if (cafeId) {
            query += ' AND (cafe_id = $1 OR cafe_id IS NULL)';
            params.push(cafeId);
          }
          query += ' ORDER BY cost ASC LIMIT 100';

          const result = await pool.query(query, params);
          return res.json(result.rows);
        } catch (err) {
          return sendApiError(res, logger, 'Error fetching rewards', err, 'Ödüller yüklenemedi.');
        }
      },
      memory: async () => {
        const rewards = Array.isArray(getMemoryRewards()) && getMemoryRewards().length > 0
          ? getMemoryRewards()
          : BASELINE_REWARDS;
        return res.json(rewards);
      },
    });
  };

  const deleteReward = async (req, res) => {
    const { id } = req.params;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            'UPDATE rewards SET is_active = false WHERE id = $1 RETURNING id, title, is_active',
            [id]
          );

          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'REWARD_NOT_FOUND',
              message: 'Ödül bulunamadı.',
            });
          }

          return res.json({ success: true });
        } catch (err) {
          return sendApiError(res, logger, 'Reward deletion error', err, 'Ödül silinemedi.');
        }
      },
      memory: async () =>
        sendApiProblem(res, {
          status: 501,
          code: 'NOT_IMPLEMENTED',
          message: 'Demo modda ödül silinemez.',
        }),
    });
  };

  const buyShopItem = async (req, res) => {
    const userId = req.user.id;
    const { rewardId, item } = req.body || {};
    const requestedRewardId = rewardId || item?.id;

    if (!requestedRewardId) {
      return sendApiProblem(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'rewardId is required',
      });
    }

    if (!(await isDbConnected())) {
      try {
        const users = getMemoryUsers();
        const userIndex = users.findIndex((entry) => Number(entry.id) === Number(userId));
        if (userIndex === -1) {
          return sendApiProblem(res, {
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          });
        }

        const rewards = Array.isArray(getMemoryRewards()) && getMemoryRewards().length > 0
          ? getMemoryRewards()
          : BASELINE_REWARDS;
        const reward = rewards.find((entry) => Number(entry.id) === Number(requestedRewardId));
        if (!reward) {
          return sendApiProblem(res, {
            status: 404,
            code: 'REWARD_NOT_FOUND',
            message: 'Reward not found',
          });
        }

        const rewardCost = Number(reward.cost);
        if (!Number.isFinite(rewardCost) || rewardCost < 0) {
          return sendApiProblem(res, {
            status: 500,
            code: 'REWARD_COST_INVALID',
            message: 'Ödül maliyeti geçersiz.',
          });
        }

        const currentPoints = Number(users[userIndex].points || 0);
        if (currentPoints < rewardCost) {
          return sendApiProblem(res, {
            status: 400,
            code: 'INSUFFICIENT_POINTS',
            message: 'Yetersiz puan.',
          });
        }

        const newPoints = currentPoints - rewardCost;
        const nextUsers = [...users];
        nextUsers[userIndex] = { ...nextUsers[userIndex], points: newPoints };
        setMemoryUsers(nextUsers);

        const coupon = {
          id: Date.now(),
          user_id: Number(userId),
          item_id: Number(reward.id),
          item_title: reward.title,
          code: `CD-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          redeemed_at: new Date(),
          is_used: false,
          used_at: null,
        };
        getMemoryItems().unshift(coupon);

        return res.json({ success: true, newPoints, reward: coupon });
      } catch (err) {
        return sendApiError(res, logger, 'Shop buy memory mode error', err, 'İşlem başarısız.');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        'SELECT points FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendApiProblem(res, {
          status: 404,
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      const rewardRes = await client.query(
        'SELECT id, title, cost FROM rewards WHERE id = $1 AND is_active = true',
        [requestedRewardId]
      );
      if (rewardRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendApiProblem(res, {
          status: 404,
          code: 'REWARD_NOT_FOUND',
          message: 'Reward not found',
        });
      }

      const reward = rewardRes.rows[0];
      const currentPoints = userRes.rows[0].points;
      if (currentPoints < reward.cost) {
        await client.query('ROLLBACK');
        return sendApiProblem(res, {
          status: 400,
          code: 'INSUFFICIENT_POINTS',
          message: 'Yetersiz puan.',
        });
      }

      const newPoints = currentPoints - reward.cost;
      await client.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);

      const code = `CD-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const redeemRes = await client.query(
        'INSERT INTO user_items (user_id, item_id, item_title, code) VALUES ($1, $2, $3, $4) RETURNING id, user_id, item_id, item_title, code, is_used, redeemed_at, used_at',
        [userId, reward.id, reward.title, code]
      );

      await client.query('COMMIT');
      return res.json({ success: true, newPoints, reward: redeemRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      return sendApiError(res, logger, 'Shop buy error', err, 'İşlem başarısız.');
    } finally {
      client.release();
    }
  };

  const getUserItems = async (req, res) => {
    const userId = Number(req.params.id);

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `SELECT id, user_id, item_id, item_title, code, redeemed_at, is_used, used_at FROM user_items 
             WHERE user_id = $1 
             AND redeemed_at > NOW() - INTERVAL '5 days'
             ORDER BY redeemed_at DESC`,
            [userId]
          );

          return res.json(
            result.rows.map((item) => ({
              ...item,
              status: item.is_used ? 'used' : 'active',
            }))
          );
        } catch (err) {
          return sendApiError(res, logger, 'Get user items error', err, 'Database error');
        }
      },
      memory: async () => {
        const now = Date.now();
        const items = getMemoryItems().filter((item) => {
          const redeemedAt = new Date(item.redeemed_at).getTime();
          return item.user_id === userId && redeemedAt >= now - FIVE_DAYS_MS;
        });
        return res.json(
          items.map((item) => ({
            ...item,
            status: item.is_used ? 'used' : 'active',
          }))
        );
      },
    });
  };

  const useCoupon = async (req, res) => {
    const { code } = req.body || {};

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `UPDATE user_items
             SET is_used = TRUE, used_at = NOW()
             WHERE code = $1 AND is_used = FALSE AND redeemed_at > NOW() - INTERVAL '5 days'
             RETURNING id, user_id, item_id, item_title, code, is_used, redeemed_at, used_at`,
            [code]
          );

          if (result.rows.length === 0) {
            return sendApiProblem(res, {
              status: 400,
              code: 'COUPON_INVALID',
              message: 'Kupon geçersiz, süresi dolmuş veya zaten kullanılmış.',
            });
          }

          return res.json({ success: true, item: result.rows[0] });
        } catch (err) {
          return sendApiError(res, logger, 'Use coupon error', err, 'Database error');
        }
      },
      memory: async () => {
        const items = getMemoryItems();
        const now = Date.now();
        const index = items.findIndex((item) => {
          const redeemedAt = new Date(item.redeemed_at).getTime();
          return item.code === code && !item.is_used && redeemedAt >= now - FIVE_DAYS_MS;
        });

        if (index === -1) {
          return sendApiProblem(res, {
            status: 400,
            code: 'COUPON_INVALID',
            message: 'Kupon bulunamadı, süresi dolmuş veya zaten kullanılmış.',
          });
        }

        items[index].is_used = true;
        items[index].used_at = new Date();
        return res.json({ success: true, item: items[index] });
      },
    });
  };

  const getShopInventory = async (req, res) => {
    const userId = req.user.id;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          const result = await pool.query(
            `SELECT id, user_id, item_id, item_title, code, is_used, redeemed_at, used_at
             FROM user_items
             WHERE user_id = $1 AND redeemed_at > NOW() - INTERVAL '5 days'
             ORDER BY redeemed_at DESC
             LIMIT 50`,
            [userId]
          );
          return res.json(
            result.rows.map((row) => ({
              redeemId: row.id,
              id: row.item_id,
              title: row.item_title,
              code: row.code,
              redeemedAt: row.redeemed_at,
              isUsed: row.is_used || false,
            }))
          );
        } catch (err) {
          return sendApiError(res, logger, 'Get inventory error', err, 'Database error');
        }
      },
      memory: async () => {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        const inventory = getMemoryItems()
          .filter(
            (item) =>
              Number(item.user_id) === Number(userId) &&
              new Date(item.redeemed_at || item.redeemedAt || Date.now()) > fiveDaysAgo
          )
          .map((item) => ({
            redeemId: item.id,
            id: item.item_id,
            title: item.item_title,
            code: item.code,
            redeemedAt: item.redeemed_at || item.redeemedAt,
            isUsed: Boolean(item.is_used || item.isUsed),
          }));
        return res.json(inventory);
      },
    });
  };

  return {
    createReward,
    getRewards,
    deleteReward,
    buyShopItem,
    getUserItems,
    useCoupon,
    getShopInventory,
  };
};

module.exports = {
  createCommerceHandlers,
};
