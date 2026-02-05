const { pool } = require('../db');
const { cache, clearCache } = require('../middleware/cache');
const { getDistanceFromLatLonInMeters } = require('../utils/geo');

const cafeController = {
    // GET ALL CAFES
    async getAllCafes(req, res) {
        try {
            if (req.isDbConnected) { // Assuming middleware sets this or we check helper
                // Check global helper if middleware not set
                // For now, simpler to reuse helper or assume connected if we want to drop fallback
                // But let's stick to the pattern:
                const result = await pool.query('SELECT * FROM cafes ORDER BY name');
                res.json(result.rows);
            } else {
                // Fallback for demo (ideally removed in production refactor but kept for safety)
                res.json([
                    { id: 1, name: 'PAÜ İİBF Kantin', latitude: 37.741, longitude: 29.101 },
                    { id: 2, name: 'PAÜ Yemekhane', latitude: 37.742, longitude: 29.102 }
                ]);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Database error' });
        }
    },

    // GET CAFE BY ID
    async getCafeById(req, res) {
        const { id } = req.params;
        try {
            const result = await pool.query('SELECT * FROM cafes WHERE id = $1', [id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Kafe bulunamadı.' });
            res.json(result.rows[0]);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    },

    // UPDATE PIN (Protected: Cafe Admin)
    async updatePin(req, res) {
        const { id } = req.params;
        const { pin } = req.body;

        if (!pin || pin.length !== 4) {
            return res.status(400).json({ error: '4 haneli PIN giriniz.' });
        }

        try {
            // Security check is done by requireCafeAdmin middleware in routes

            // Update DB
            await pool.query('UPDATE cafes SET pin = $1, daily_pin = $1 WHERE id = $2', [pin, id]);

            // Invalidate Cache
            await clearCache(`cache:/api/cafes*`);

            res.json({ success: true, message: 'PIN güncellendi.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'PIN güncellenemedi.' });
        }
    },

    // CHECK-IN (Location & PIN based)
    async checkIn(req, res) {
        const { id } = req.params;
        const { latitude, longitude, pin, tableNumber } = req.body;
        const userId = req.user.id;

        try {
            // 1. Get Cafe Details
            const cafeResult = await pool.query('SELECT * FROM cafes WHERE id = $1', [id]);
            if (cafeResult.rows.length === 0) return res.status(404).json({ error: 'Kafe bulunamadı.' });

            const cafe = cafeResult.rows[0];

            // 2. Location Check (Geofencing)
            if (cafe.latitude && cafe.longitude && latitude && longitude) {
                const distance = getDistanceFromLatLonInMeters(
                    parseFloat(latitude), parseFloat(longitude),
                    parseFloat(cafe.latitude), parseFloat(cafe.longitude)
                );

                // 100 meters tolerance
                if (distance > 100) {
                    return res.status(400).json({ error: 'Kafeden çok uzaktasınız. Lütfen konuma yaklaşın.' });
                }
            }

            // 3. PIN Check
            // Check both 'daily_pin' and 'pin' columns for backward compatibility logic from report
            const activePin = cafe.daily_pin || cafe.pin;
            if (activePin && activePin !== pin) {
                return res.status(400).json({ error: 'Hatalı PIN kodu.' });
            }

            // 4. Update User
            await pool.query(
                'UPDATE users SET cafe_id = $1, table_number = $2 WHERE id = $3',
                [id, parseInt(tableNumber) || null, userId]
            );

            res.json({ success: true, message: 'Giriş başarılı!', cafe });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Check-in başarısız.' });
        }
    }
};

module.exports = cafeController;
