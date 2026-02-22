const db = require('../db');

// Mağaza Eşyaları (Hardcoded yapılandırma - İleride tabloya alınabilir)
const STORE_ITEMS = [
    { id: 1, title: 'Zehirli Neon Kılıç (Rütbe)', code: 'RANK_NEON_SWORD', price: 500, type: 'rank', description: 'Profilinde sarkan fosforlu bir kılıç rütbesi.' },
    { id: 2, title: 'Hacker Çerçevesi (Kırmızı)', code: 'FRAME_HACKER_RED', price: 1000, type: 'frame', description: 'Profil resminin etrafında dönen kırmızı glitch çerçevesi.' },
    { id: 3, title: 'Siber Ajan Ünvanı', code: 'TITLE_CYBER_AGENT', price: 250, type: 'title', description: 'Adının altında beliren prestijli bir ünvan.' },
    { id: 4, title: 'Enerji Nükleosu (Animasyon)', code: 'ANIM_ENERGY_CORE', price: 1500, type: 'animation', description: 'Profiline girenleri karşılayan patlayan bir enerji çekirdeği efekti.' },
    { id: 5, title: 'Efsanevi Ejderha Çerçevesi', code: 'FRAME_DRAGON_GOLD', price: 3000, type: 'frame', description: 'Altın renkli, efsanevi statü çerçevesi.' },
    { id: 6, title: 'Bounty Hunter Rütbesi', code: 'RANK_BOUNTY_HUNTER', price: 800, type: 'rank', description: 'Acımasız avcılar için özel rütbe.' }
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
                'SELECT * FROM user_items WHERE user_id = $1 ORDER BY redeemed_at DESC',
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

            const itemToBuy = STORE_ITEMS.find(item => item.id === parseInt(itemId));
            if (!itemToBuy) {
                return res.status(404).json({ success: false, message: 'Eşya bulunamadı' });
            }

            await client.query('BEGIN');

            // 1. Kullanıcının puanını ve bakiyesini kontrol et
            const userResult = await client.query('SELECT points FROM users WHERE id = $1 FOR UPDATE', [userId]);
            if (userResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı' });
            }

            const userPoints = userResult.rows[0].points;
            if (userPoints < itemToBuy.price) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Yetersiz bakiye (Cyber-Creds)' });
            }

            // 2. Kullanıcının bu eşyaya zaten sahip olup olmadığını kontrol et
            const existingItem = await client.query('SELECT id FROM user_items WHERE user_id = $1 AND code = $2', [userId, itemToBuy.code]);
            if (existingItem.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Bu eşyaya zaten sahipsiniz' });
            }

            // 3. Puanı düş
            await client.query('UPDATE users SET points = points - $1 WHERE id = $2', [itemToBuy.price, userId]);

            // 4. Eşyayı envantere ekle
            const insertResult = await client.query(
                `INSERT INTO user_items (user_id, item_id, item_title, code) 
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [userId, itemToBuy.id, itemToBuy.title, itemToBuy.code]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Satın alma başarılı',
                inventoryItem: insertResult.rows[0],
                remainingPoints: userPoints - itemToBuy.price
            });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('buyItem error:', error);
            res.status(500).json({ success: false, message: 'Satın alma işlemi sırasında hata oluştu' });
        } finally {
            client.release();
        }
    }
};

module.exports = storeController;
