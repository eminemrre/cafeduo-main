const db = require('../db');
const logger = require('../utils/logger');
const { sendApiError, sendApiProblem } = require('../utils/routeHelpers');
const { rollbackQuietly } = require('../utils/transaction');
const { generateCouponCode } = require('../utils/couponCode');

// Mağaza Eşyaları (Hardcoded yapılandırma - İleride tabloya alınabilir)
const STORE_ITEMS = [
  {
    id: 1,
    title: 'Karamel Kaşık (Rütbe)',
    code: 'RANK_CARAMEL_SPOON',
    price: 500,
    type: 'rank',
    description: 'Profilinde sallanan parlak bir kaşık rütbesi.',
  },
  {
    id: 2,
    title: 'Lokum Çerçevesi (Pembe)',
    code: 'FRAME_HACKER_RED',
    price: 1000,
    type: 'frame',
    description: 'Profil resminin etrafında dönen pembe bir lokum çerçevesi.',
  },
  {
    id: 3,
    title: 'Masa Ustası Unvanı',
    code: 'TITLE_TABLE_MASTER',
    price: 250,
    type: 'title',
    description: 'Adının altında beliren prestijli bir unvan.',
  },
  {
    id: 4,
    title: 'Konfeti Patlaması (Animasyon)',
    code: 'ANIM_ENERGY_CORE',
    price: 1500,
    type: 'animation',
    description: 'Profiline girenleri karşılayan bir konfeti efekti.',
  },
  {
    id: 5,
    title: 'Efsanevi Ejderha Çerçevesi',
    code: 'FRAME_DRAGON_GOLD',
    price: 3000,
    type: 'frame',
    description: 'Altın renkli, efsanevi statü çerçevesi.',
  },
  {
    id: 6,
    title: 'Ödül Avcısı Rütbesi',
    code: 'RANK_BOUNTY_HUNTER',
    price: 800,
    type: 'rank',
    description: 'Turnuvaların gediklisi için özel rütbe.',
  },
];

const storeController = {
  // Mağazadaki tüm eşyaları getir (Auth Opsiyonel)
  getItems: async (req, res) => {
    try {
      res.json({ success: true, items: STORE_ITEMS });
    } catch (error) {
      return sendApiError(res, logger, 'store.getItems', error, 'Sunucu hatası');
    }
  },

  // Kullanıcının envanterini getir
  getInventory: async (req, res) => {
    try {
      const userId = req.user.id;

      const result = await db.query(
        `SELECT id, user_id, item_id, item_title, code, is_used, redeemed_at, used_at
                 FROM user_items
                 WHERE user_id = $1
                 ORDER BY redeemed_at DESC
                 LIMIT 100`,
        [userId]
      );

      res.json({ success: true, inventory: result.rows });
    } catch (error) {
      return sendApiError(
        res,
        logger,
        'store.getInventory',
        error,
        'Envanter alınırken hata oluştu'
      );
    }
  },

  // Eşya satın alma
  buyItem: async (req, res) => {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { itemId } = req.body;

      if (!itemId) {
        return sendApiProblem(res, {
          status: 400,
          code: 'INVALID_ITEM_ID',
          message: 'Eşya ID gerekli',
        });
      }

      const itemToBuy = STORE_ITEMS.find((item) => item.id === parseInt(itemId));
      if (!itemToBuy) {
        return sendApiProblem(res, {
          status: 404,
          code: 'ITEM_NOT_FOUND',
          message: 'Eşya bulunamadı',
        });
      }

      await client.query('BEGIN');

      // 1. Kullanıcının puanını ve bakiyesini kontrol et
      const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      if (userResult.rows.length === 0) {
        await rollbackQuietly(client);
        return sendApiProblem(res, {
          status: 404,
          code: 'USER_NOT_FOUND',
          message: 'Kullanıcı bulunamadı',
        });
      }

      const userPoints = userResult.rows[0].points;
      if (userPoints < itemToBuy.price) {
        await rollbackQuietly(client);
        return sendApiProblem(res, {
          status: 400,
          code: 'INSUFFICIENT_POINTS',
          message: 'Yetersiz puan.',
        });
      }

      // 2. Kullanıcının bu eşyaya zaten sahip olup olmadığını kontrol et
      //    (kontrol item_id üzerinden yapılır, çünkü kupon kodu artık her
      //    satın alımda benzersiz üretilir).
      const existingItem = await client.query(
        'SELECT id FROM user_items WHERE user_id = $1 AND item_id = $2',
        [userId, itemToBuy.id]
      );
      if (existingItem.rows.length > 0) {
        await rollbackQuietly(client);
        return sendApiProblem(res, {
          status: 400,
          code: 'ITEM_ALREADY_OWNED',
          message: 'Bu eşyaya zaten sahipsin',
        });
      }

      // 3. Puanı düş
      await client.query('UPDATE users SET points = points - $1 WHERE id = $2', [
        itemToBuy.price,
        userId,
      ]);

      // 4. Eşyayı envantere ekle — kullanıcıya özel benzersiz kupon kodu üret
      //    ve UNIQUE constraint çakışmasına karşı 3 deneme yap.
      let insertResult = null;
      let attempt = 0;
      while (attempt < 3 && !insertResult) {
        attempt += 1;
        const code = generateCouponCode();
        try {
          insertResult = await client.query(
            `INSERT INTO user_items (user_id, item_id, item_title, code)
                         VALUES ($1, $2, $3, $4) RETURNING id, user_id, item_id, item_title, code, is_used, redeemed_at, used_at`,
            [userId, itemToBuy.id, itemToBuy.title, code]
          );
        } catch (insertErr) {
          if (insertErr && insertErr.code === '23505' && attempt < 3) {
            insertResult = null;
            continue;
          }
          throw insertErr;
        }
      }
      if (!insertResult) {
        await rollbackQuietly(client);
        return sendApiError(
          res,
          logger,
          'store.buyItem',
          new Error('Coupon code generation failed'),
          'Kupon oluşturulamadı, lütfen tekrar deneyin.'
        );
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Satın alma başarılı',
        inventoryItem: insertResult.rows[0],
        remainingPoints: userPoints - itemToBuy.price,
      });
    } catch (error) {
      await rollbackQuietly(client);
      return sendApiError(
        res,
        logger,
        'store.buyItem',
        error,
        'Satın alma işlemi sırasında hata oluştu'
      );
    } finally {
      client.release();
    }
  },
};

module.exports = storeController;
