// eslint-disable-next-line no-redeclare
const crypto = require('crypto');
const db = require('../db');
const { rollbackQuietly } = require('../utils/transaction');

/**
 * Per-redemption unique coupon code. Same format as commerceHandlers
 * (CD-XXXX-XXXX-XXXX) so the cafe-admin scanner can validate codes
 * from either path uniformly.
 */
const generateCouponCode = () => {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CD-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
};

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
    title: 'Hacker Çerçevesi (Kırmızı)',
    code: 'FRAME_HACKER_RED',
    price: 1000,
    type: 'frame',
    description: 'Profil resminin etrafında dönen kırmızı glitch çerçevesi.',
  },
  {
    id: 3,
    title: 'Masa Ustası Ünvanı',
    code: 'TITLE_TABLE_MASTER',
    price: 250,
    type: 'title',
    description: 'Adının altında beliren prestijli bir ünvan.',
  },
  {
    id: 4,
    title: 'Enerji Nükleosu (Animasyon)',
    code: 'ANIM_ENERGY_CORE',
    price: 1500,
    type: 'animation',
    description: 'Profiline girenleri karşılayan patlayan bir enerji çekirdeği efekti.',
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
    title: 'Bounty Hunter Rütbesi',
    code: 'RANK_BOUNTY_HUNTER',
    price: 800,
    type: 'rank',
    description: 'Acımasız avcılar için özel rütbe.',
  },
];

const storeController = {
  // Mağazadaki tüm eşyaları getir (Auth Opsiyonel)
  getItems: async (req, res) => {
    try {
      res.json({ success: true, items: STORE_ITEMS });
    } catch (error) {
      console.error('getItems error:', error);
      res.status(500).json({ success: false, message: 'Sunucu hatası' });
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
      console.error('getInventory error:', error);
      res.status(500).json({ success: false, message: 'Envanter alınırken hata oluştu' });
    }
  },

  // Eşya satın alma
  buyItem: async (req, res) => {
    const client = await db.pool.connect();
    try {
      const userId = req.user.id;
      const { itemId } = req.body;

      if (!itemId) {
        return res.status(400).json({ success: false, message: 'Eşya ID gerekli' });
      }

      const itemToBuy = STORE_ITEMS.find((item) => item.id === parseInt(itemId));
      if (!itemToBuy) {
        return res.status(404).json({ success: false, message: 'Eşya bulunamadı' });
      }

      await client.query('BEGIN');

      // 1. Kullanıcının puanını ve bakiyesini kontrol et
      const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      if (userResult.rows.length === 0) {
        await rollbackQuietly(client);
        return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
      }

      const userPoints = userResult.rows[0].points;
      if (userPoints < itemToBuy.price) {
        await rollbackQuietly(client);
        return res.status(400).json({ success: false, message: 'Yetersiz puan.' });
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
        return res.status(400).json({ success: false, message: 'Bu eşyaya zaten sahipsiniz' });
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
        return res
          .status(500)
          .json({ success: false, message: 'Kupon oluşturulamadı, lütfen tekrar deneyin.' });
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
      console.error('buyItem error:', error);
      res.status(500).json({ success: false, message: 'Satın alma işlemi sırasında hata oluştu' });
    } finally {
      client.release();
    }
  },
};

module.exports = storeController;
