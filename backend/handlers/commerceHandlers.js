// eslint-disable-next-line no-redeclare
const crypto = require('crypto');
const { executeDataMode, sendApiError, sendApiProblem } = require('../utils/routeHelpers');
// Cache invalidator for GET /rewards — the route is wrapped in cache(600s) so
// admin create/delete must flush or users see stale catalog for up to 10min.
const { clearCache } = require('../middleware/cache');

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Build a per-redemption unique coupon code. 12 hex chars in three groups
 * of 4 (CD-XXXX-XXXX-XXXX) — short enough to read aloud at the cashier if
 * the QR fails, long enough to make accidental collisions astronomically
 * unlikely (48 bits of entropy).
 */
const generateCouponCode = () => {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CD-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
};

// One wheel for every cafe. Weights are relative to their sum, so they need not add up to 100.
// The gift slice issues a coupon instead of points.
const DAILY_WHEEL_SLICES = Object.freeze([
  { points: 15, weight: 75 },
  { points: 50, weight: 20 },
  { points: 250, weight: 4 },
  {
    points: 0,
    weight: 1,
    gift: { label: 'Bedava Kahve', itemTitle: 'Bedava Kahve (Çarktan)' },
  },
]);
const BASELINE_REWARDS = [
  {
    id: 9001,
    title: 'Bedava Filtre Kahve',
    cost: 500,
    description: 'Günün yorgunluğunu at.',
    icon: 'coffee',
  },
  {
    id: 9002,
    title: '%20 Hesap İndirimi',
    cost: 850,
    description: 'Tüm masada geçerli.',
    icon: 'discount',
  },
  {
    id: 9003,
    title: 'Cheesecake İkramı',
    cost: 400,
    description: 'Tatlı bir mola ver.',
    icon: 'dessert',
  },
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
  // Per-cafe baseline seed. When a cafe has zero active rewards, drop in
  // four default offerings OWNED BY THAT CAFE (cafe_id = <this cafe>) so
  // every new cafe starts with a usable catalog. This still satisfies the
  // strict cafe-scope rule the user asked for — these rows live in the
  // target cafe only; the Ev admin's rewards never leak to PAÜ İİBF and
  // vice versa. Cafe admins can edit / delete / extend from this baseline.
  const ensureActiveRewardsDb = async (cafeId) => {
    if (!cafeId) return;
    const cafeIdNum = Number(cafeId);
    if (!Number.isFinite(cafeIdNum) || cafeIdNum <= 0) return;
    try {
      const countRes = await pool.query(
        'SELECT COUNT(*)::int AS count FROM rewards WHERE is_active = true AND cafe_id = $1',
        [cafeIdNum]
      );
      if (Number(countRes.rows?.[0]?.count || 0) > 0) {
        return;
      }
      await pool.query(
        `INSERT INTO rewards (title, cost, description, icon, cafe_id, is_active)
         VALUES
           ('Bedava Filtre Kahve', 500, 'Günün yorgunluğunu at.', 'coffee', $1, true),
           ('%20 Hesap İndirimi', 850, 'Tüm masada geçerli.', 'discount', $1, true),
           ('Cheesecake İkramı', 400, 'Tatlı bir mola ver.', 'dessert', $1, true),
           ('Oyun Jetonu x5', 100, 'Ekstra oyun hakkı.', 'game', $1, true)`,
        [cafeIdNum]
      );
      logger.info('Baseline rewards seeded for cafe', { cafeId: cafeIdNum });
    } catch (err) {
      logger.warn('Baseline rewards seed failed (soft-fail)', {
        cafeId: cafeIdNum,
        message: err?.message,
        code: err?.code,
      });
    }
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
          await clearCache('cache:/api/rewards*').catch((err) => {
            logger.warn(`Reward cache invalidation failed after create: ${err.message}`);
          });
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
    // Rewards are STRICTLY cafe-scoped. The frontend must pass cafeId
    // (typically the logged-in user's cafe_id). Without it we return an
    // empty list rather than dumping every cafe's catalog — that's the
    // "every cafe is its own loyalty universe" guarantee the project is
    // built around. Old `cafe_id IS NULL` house-reward fallback removed
    // alongside the auto-seed.
    const { cafeId } = req.query;

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          if (!cafeId) {
            return res.json([]);
          }
          // Auto-seed this cafe's baseline catalog on first read if the
          // cafe admin hasn't added anything yet. Idempotent — does
          // nothing once the cafe has any active reward.
          await ensureActiveRewardsDb(cafeId);
          const result = await pool.query(
            `SELECT id, title, description, cost, icon, cafe_id, is_active, created_at
               FROM rewards
              WHERE is_active = true AND cafe_id = $1
              ORDER BY cost ASC
              LIMIT 100`,
            [cafeId]
          );
          return res.json(result.rows);
        } catch (err) {
          return sendApiError(res, logger, 'Error fetching rewards', err, 'Ödüller yüklenemedi.');
        }
      },
      memory: async () => {
        if (!cafeId) {
          return res.json([]);
        }
        const targetCafeId = Number(cafeId);
        const all = Array.isArray(getMemoryRewards()) ? getMemoryRewards() : [];
        const filtered = all.filter((reward) => Number(reward?.cafe_id) === targetCafeId);
        // Memory-mode baseline seed parallel to the DB branch. When E2E
        // tests boot the backend with no DB and call /api/rewards?cafeId=N,
        // we synthesize the same 4 default rewards owned by that cafe so
        // the shop UI has something to render. Filtered list isn't mutated
        // across requests — these are stateless per-call defaults.
        if (filtered.length === 0) {
          return res.json(
            BASELINE_REWARDS.map((r) => ({
              ...r,
              cafe_id: targetCafeId,
              is_active: true,
            }))
          );
        }
        return res.json(filtered);
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

          await clearCache('cache:/api/rewards*').catch((err) => {
            logger.warn(`Reward cache invalidation failed after delete: ${err.message}`);
          });
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

        const rewards =
          Array.isArray(getMemoryRewards()) && getMemoryRewards().length > 0
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

      const userRes = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendApiProblem(res, {
          status: 404,
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      const rewardRes = await client.query(
        'SELECT id, title, cost, cafe_id FROM rewards WHERE id = $1 AND is_active = true',
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

      // Cafe association for the coupon — reward's own cafe_id wins if it is
      // a cafe-specific reward (the cafe admin who created it knows where it
      // belongs). For "house" rewards (cafe_id NULL) we fall back to the
      // buyer's current cafe (where they checked in). This way the cafe
      // admin who later scans the QR can be checked against the right cafe.
      const buyerCafeRes = await client.query('SELECT cafe_id FROM users WHERE id = $1', [userId]);
      const couponCafeId = reward.cafe_id ?? buyerCafeRes.rows[0]?.cafe_id ?? null;

      const newPoints = currentPoints - reward.cost;
      await client.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);

      // Per-redemption unique coupon code. Format: CD-XXXX-XXXX-XXXX
      // (12 hex chars = 48 bits randomness → collision odds ~2.8e14).
      // user_items.code has a UNIQUE INDEX (migration 20260513000003), so
      // on the freakishly rare collision the INSERT will fail; we retry up
      // to 3 times before giving up. In practice this loop almost never
      // iterates past i=0.
      let code = '';
      let redeemRes = null;
      let attempt = 0;
      while (attempt < 3 && !redeemRes) {
        attempt += 1;
        code = generateCouponCode();
        try {
          redeemRes = await client.query(
            'INSERT INTO user_items (user_id, item_id, item_title, code, cafe_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, item_id, item_title, code, cafe_id, is_used, redeemed_at, used_at',
            [userId, reward.id, reward.title, code, couponCafeId]
          );
        } catch (insertErr) {
          // unique_violation pg error code = 23505. Retry; any other error is fatal.
          if (insertErr && insertErr.code === '23505' && attempt < 3) {
            redeemRes = null;
            continue;
          }
          throw insertErr;
        }
      }
      if (!redeemRes) {
        await client.query('ROLLBACK');
        return sendApiError(
          res,
          logger,
          'Coupon code generation collision',
          new Error('Failed to allocate unique coupon code after 3 attempts'),
          'Kupon oluşturulamadı, lütfen tekrar deneyin.'
        );
      }

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
             ORDER BY redeemed_at DESC
             LIMIT 100`,
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
          items.slice(0, 100).map((item) => ({
            ...item,
            status: item.is_used ? 'used' : 'active',
          }))
        );
      },
    });
  };

  const useCoupon = async (req, res) => {
    const { code } = req.body || {};
    // Cafe-admin's own cafe — cross-cafe redemption is the bug we're fixing.
    // `requireCafeAdmin` middleware already populated req.user with the
    // admin's profile, so cafe_id is on the auth payload. Super-admins
    // (role='admin') have cafe_id NULL — they get to scan any cafe.
    const adminCafeId = req.user?.cafe_id ?? null;
    const isSuperAdmin = String(req.user?.role || '') === 'admin';

    return executeDataMode(isDbConnected, {
      db: async () => {
        try {
          // Three-tier matching:
          //   1. Super admin (cafe_id NULL on the user row) → no cafe filter.
          //   2. Cafe admin → coupon must belong to their cafe, OR be a
          //      legacy NULL row (pre-PR #36 coupons that we can't reassign).
          //   3. Cafe admin without a cafe_id → reject everything (defensive).
          const couponQuery = isSuperAdmin
            ? `UPDATE user_items
                   SET is_used = TRUE, used_at = NOW()
                 WHERE code = $1 AND is_used = FALSE
                   AND redeemed_at > NOW() - INTERVAL '5 days'
                 RETURNING id, user_id, item_id, item_title, code, cafe_id, is_used, redeemed_at, used_at`
            : `UPDATE user_items
                   SET is_used = TRUE, used_at = NOW()
                 WHERE code = $1 AND is_used = FALSE
                   AND redeemed_at > NOW() - INTERVAL '5 days'
                   AND (cafe_id = $2 OR cafe_id IS NULL)
                 RETURNING id, user_id, item_id, item_title, code, cafe_id, is_used, redeemed_at, used_at`;
          const params = isSuperAdmin ? [code] : [code, adminCafeId];

          if (!isSuperAdmin && !adminCafeId) {
            return sendApiProblem(res, {
              status: 403,
              code: 'CAFE_ADMIN_NO_CAFE',
              message: 'Bu hesap bir kafeye bağlı değil. Yöneticiden kafe ataması iste.',
            });
          }

          const result = await pool.query(couponQuery, params);

          if (result.rows.length === 0) {
            // Distinguish "coupon belongs to a different cafe" from "doesn't
            // exist / used / expired" — check first WITHOUT the cafe filter
            // so we can give the cafe admin a clearer message.
            if (!isSuperAdmin) {
              const exists = await pool.query(
                `SELECT cafe_id FROM user_items
                   WHERE code = $1 AND is_used = FALSE
                     AND redeemed_at > NOW() - INTERVAL '5 days'
                   LIMIT 1`,
                [code]
              );
              if (exists.rows.length > 0 && exists.rows[0].cafe_id !== null) {
                return sendApiProblem(res, {
                  status: 403,
                  code: 'COUPON_WRONG_CAFE',
                  message: 'Bu kupon başka bir kafeye ait, burada kullanılamaz.',
                });
              }
            }
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
          if (item.code !== code || item.is_used) return false;
          if (redeemedAt < now - FIVE_DAYS_MS) return false;
          if (isSuperAdmin) return true;
          if (item.cafe_id == null) return true; // legacy
          return Number(item.cafe_id) === Number(adminCafeId);
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

  /**
   * Per-cafe daily reward wheel. Each cafe owns a JSONB array of
   * `{points, weight}` slices; users spin once per Turkish calendar day
   * per cafe. Unique constraint on (user_id, cafe_id, DATE(spun_at TZ))
   * is the race-condition primitive — a second concurrent INSERT throws
   * 23505 which we surface as "zaten çevirdin".
   *
   * Declared BEFORE the return statement (originally these were function
   * declarations after the return, which hoisted but surfaced a runtime
   * 500 after deploy — bundler/runtime hoisting subtlety). Linear order
   * now: declare, then return.
   */

  /**
   * Wheel slices that the frontend renders. Weights are kept as-is so the
   * client can compute % chips for display; the backend uses the same
   * numbers when picking. `gift` is sent when a slice gives a coupon
   * instead of points.
   */
  const exposedWheelSlices = () =>
    DAILY_WHEEL_SLICES.map((slice) => ({
      points: slice.points,
      weight: slice.weight,
      gift: slice.gift ? { label: slice.gift.label } : null,
    }));

  const getDailyWheel = async (req, res) => {
    const userId = Number(req.user?.id);
    const cafeId = Number(req.params?.cafeId ?? req.user?.cafe_id ?? 0);
    if (!cafeId) {
      return sendApiProblem(res, {
        status: 400,
        code: 'CAFE_ID_REQUIRED',
        message: 'Kafe seçilmedi.',
      });
    }
    return executeDataMode(isDbConnected, {
      db: async () => {
        // STEP 1 — cafe name lookup. Soft-fail: if the lookup throws, we
        // still want the user to see the wheel. Only a clean empty result
        // (i.e. cafe doesn't exist) returns 404. Anything else we treat as
        // "we don't know the name but the cafe is probably real".
        let cafeName = null;
        try {
          const cafeRes = await pool.query(`SELECT name FROM cafes WHERE id = $1`, [cafeId]);
          if (cafeRes.rows.length === 0) {
            return sendApiProblem(res, {
              status: 404,
              code: 'CAFE_NOT_FOUND',
              message: 'Kafe bulunamadı.',
            });
          }
          cafeName = cafeRes.rows[0].name;
        } catch (cafeErr) {
          logger.error('Get wheel: cafe lookup failed (soft-fail)', {
            userId,
            cafeId,
            message: cafeErr?.message,
            code: cafeErr?.code,
          });
          // Continue with cafeName=null; user still gets a usable wheel.
        }

        // STEP 2 — "already spun today" lookup. If this fails (timezone
        // not loaded, table missing, whatever), we degrade to "not spun
        // yet" rather than blocking the wheel render. Worst case the user
        // tries to spin and the unique index on user_daily_spins catches
        // a duplicate; spinDailyWheel handles 23505 cleanly.
        let alreadySpunToday = false;
        let lastSpin = null;
        try {
          const spinRes = await pool.query(
            `SELECT id, points_won, spun_at FROM user_daily_spins
               WHERE user_id = $1 AND cafe_id = $2
                 AND (spun_at AT TIME ZONE 'Europe/Istanbul')::date
                   = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
               ORDER BY spun_at DESC LIMIT 1`,
            [userId, cafeId]
          );
          alreadySpunToday = spinRes.rows.length > 0;
          lastSpin = spinRes.rows[0] || null;
        } catch (spinErr) {
          logger.error('Get wheel: spin-lookup failed (soft-fail)', {
            userId,
            cafeId,
            message: spinErr?.message,
            code: spinErr?.code,
          });
          // Stay with alreadySpunToday=false; spinDailyWheel enforces
          // uniqueness server-side anyway.
        }

        return res.json({
          cafeId,
          cafeName,
          wheel: exposedWheelSlices(),
          alreadySpunToday,
          lastSpin,
        });
      },
      memory: async () =>
        res.json({
          cafeId,
          wheel: exposedWheelSlices(),
          alreadySpunToday: false,
          lastSpin: null,
        }),
    });
  };

  const spinDailyWheel = async (req, res) => {
    const userId = Number(req.user?.id);
    const cafeId = Number(req.params?.cafeId ?? req.user?.cafe_id ?? 0);
    if (!cafeId) {
      return sendApiProblem(res, {
        status: 400,
        code: 'CAFE_ID_REQUIRED',
        message: 'Kafe seçilmedi.',
      });
    }
    if (!(await isDbConnected())) {
      return sendApiProblem(res, {
        status: 501,
        code: 'NOT_IMPLEMENTED',
        message: 'Demo modda çark çevrilemez.',
      });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Confirm the cafe exists before we burn a daily-spin slot for it.
      const cafeRes = await client.query(`SELECT id FROM cafes WHERE id = $1`, [cafeId]);
      if (cafeRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return sendApiProblem(res, {
          status: 404,
          code: 'CAFE_NOT_FOUND',
          message: 'Kafe bulunamadı.',
        });
      }

      // Weighted random pick from the global DAILY_WHEEL_SLICES. Weights
      // are relative — we sum the weights then map a random point to the
      // first slice whose running total covers it.
      const slices = DAILY_WHEEL_SLICES;
      const totalWeight = slices.reduce((sum, s) => sum + s.weight, 0);
      let r = Math.random() * totalWeight;
      let picked = slices[0];
      let pickedIndex = 0;
      for (let i = 0; i < slices.length; i += 1) {
        r -= slices[i].weight;
        if (r <= 0) {
          picked = slices[i];
          pickedIndex = i;
          break;
        }
      }

      try {
        // Always record the spin in user_daily_spins. points_won is 0 for
        // gift slices — the actual prize for them is a coupon row.
        const spinRes = await client.query(
          `INSERT INTO user_daily_spins (user_id, cafe_id, points_won)
             VALUES ($1, $2, $3)
             RETURNING id, points_won, spun_at`,
          [userId, cafeId, picked.points || 0]
        );

        let coupon = null;
        if (picked.gift) {
          // Gift slices issue a coupon (e.g. "Bedava Kahve") instead of
          // adding to the user's point balance. Coupon code is the same
          // CD-XXXX-XXXX-XXXX format every other reward uses, so the
          // cafe-admin scanner picks it up via the existing flow. We retry
          // up to 3 times on a unique_violation in case the freak collision
          // hits.
          let attempt = 0;
          while (attempt < 3 && !coupon) {
            attempt += 1;
            try {
              const couponRes = await client.query(
                `INSERT INTO user_items (user_id, item_id, item_title, code, cafe_id)
                   VALUES ($1, $2, $3, $4, $5)
                   RETURNING id, code, item_title, cafe_id, redeemed_at`,
                [userId, 0, picked.gift.itemTitle, generateCouponCode(), cafeId]
              );
              coupon = couponRes.rows[0];
            } catch (insertErr) {
              if (insertErr && insertErr.code === '23505' && attempt < 3) {
                continue;
              }
              throw insertErr;
            }
          }
        } else if (picked.points > 0) {
          await client.query(`UPDATE users SET points = points + $1 WHERE id = $2`, [
            picked.points,
            userId,
          ]);
        }

        await client.query('COMMIT');
        return res.json({
          success: true,
          pointsWon: picked.points || 0,
          pickedIndex,
          gift: picked.gift ? { label: picked.gift.label, coupon } : null,
          spin: spinRes.rows[0],
        });
      } catch (err) {
        await client.query('ROLLBACK');
        if (err && err.code === '23505') {
          return sendApiProblem(res, {
            status: 409,
            code: 'ALREADY_SPUN_TODAY',
            message: 'Bugün bu kafede zaten çark çevirdin. Yarın tekrar dene.',
          });
        }
        throw err;
      }
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* already rolled */
      }
      return sendApiError(res, logger, 'Spin wheel error', err, 'Çark çevirme başarısız.');
    } finally {
      client.release();
    }
  };

  /**
   * Cafe admin endpoint — used to overwrite the cafe's wheel slices.
   * Wheel is global now (DAILY_WHEEL_SLICES constant), so this endpoint
   * returns 410 Gone for any old admin client still trying to PUT to it.
   * The route + handler will be removed in a later cleanup pass.
   */
  const setCafeWheel = async (_req, res) =>
    sendApiProblem(res, {
      status: 410,
      code: 'WHEEL_NOT_EDITABLE',
      message: 'Çark artık tüm kafelerde sabit; düzenlenemez.',
    });

  return {
    createReward,
    getRewards,
    deleteReward,
    buyShopItem,
    getUserItems,
    useCoupon,
    getShopInventory,
    getDailyWheel,
    spinDailyWheel,
    setCafeWheel,
  };
};

module.exports = {
  createCommerceHandlers,
};
