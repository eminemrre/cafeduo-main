const { pool, isDbConnected } = require('../db');
const { cache, clearCache } = require('../middleware/cache');
const { getDistanceFromLatLonInMeters } = require('../utils/geo');
const memoryState = require('../store/memoryState');

const FALLBACK_CAFES = [
    {
        id: 1,
        name: 'PAÜ İİBF Kantin',
        latitude: 37.741,
        longitude: 29.101,
        table_count: 20,
        pin: '1234',
        daily_pin: '0000',
    },
    {
        id: 2,
        name: 'PAÜ Yemekhane',
        latitude: 37.742,
        longitude: 29.102,
        table_count: 20,
        pin: '1234',
        daily_pin: '0000',
    },
];

const cafeController = {
    // GET ALL CAFES
    async getAllCafes(req, res) {
        try {
            const result = await pool.query('SELECT * FROM cafes ORDER BY name');
            res.json(result.rows);
        } catch (err) {
            console.error('getAllCafes DB error, returning fallback list:', err.message);
            // Fallback for demo mode and temporary DB outages
            res.json(
                FALLBACK_CAFES.map(({ pin, daily_pin, ...publicCafe }) => publicCafe)
            );
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

        if (!pin || !/^\d{4,6}$/.test(String(pin))) {
            return res.status(400).json({ error: '4-6 haneli PIN giriniz.' });
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

    // CHECK-IN (Location based)
    async checkIn(req, res) {
        const { id } = req.params;
        const { latitude, longitude, tableNumber } = req.body;
        const userId = req.user.id;

        const parsedLatitude = Number(latitude);
        const parsedLongitude = Number(longitude);
        if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
            return res.status(400).json({ error: 'Kafe doğrulaması için konum izni gerekli.' });
        }

        if (!(await isDbConnected())) {
            const cafe = FALLBACK_CAFES.find((item) => Number(item.id) === Number(id));
            if (!cafe) return res.status(404).json({ error: 'Kafe bulunamadı.' });

            const fallbackRadius = Number(cafe.radius || 150);
            const distance = getDistanceFromLatLonInMeters(
                parsedLatitude,
                parsedLongitude,
                Number(cafe.latitude),
                Number(cafe.longitude)
            );
            if (Number.isFinite(distance) && distance > fallbackRadius) {
                return res.status(400).json({
                    error: `Kafeden çok uzaktasınız. Lütfen ${fallbackRadius} metre içine yaklaşın.`,
                });
            }

            const maxTableCount = Number(cafe.table_count || 20);
            const parsedTableNumber = Number(tableNumber);
            if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1 || parsedTableNumber > maxTableCount) {
                return res.status(400).json({ error: `Masa numarası 1-${maxTableCount} aralığında olmalıdır.` });
            }

            const userIndex = memoryState.users.findIndex((user) => Number(user.id) === Number(userId));
            if (userIndex >= 0) {
                memoryState.users[userIndex] = {
                    ...memoryState.users[userIndex],
                    cafe_id: Number(id),
                    table_number: parsedTableNumber,
                };
            }

            return res.json({
                success: true,
                message: 'Giriş başarılı!',
                cafe: {
                    id: cafe.id,
                    name: cafe.name,
                    latitude: cafe.latitude,
                    longitude: cafe.longitude,
                },
                cafeName: cafe.name,
                table: `MASA${String(parsedTableNumber).padStart(2, '0')}`
            });
        }

        try {
            // 1. Get Cafe Details
            const cafeResult = await pool.query('SELECT * FROM cafes WHERE id = $1', [id]);
            if (cafeResult.rows.length === 0) return res.status(404).json({ error: 'Kafe bulunamadı.' });

            const cafe = cafeResult.rows[0];

            // 2. Location Check (Geofencing)
            if (cafe.latitude && cafe.longitude) {
                const radius = Number(cafe.radius || 150);
                const distance = getDistanceFromLatLonInMeters(
                    parsedLatitude, parsedLongitude,
                    parseFloat(cafe.latitude), parseFloat(cafe.longitude)
                );

                if (distance > radius) {
                    return res.status(400).json({
                        error: `Kafeden çok uzaktasınız. Lütfen ${radius} metre içine yaklaşın.`,
                    });
                }
            }

            const maxTableCount = Number(cafe.table_count || cafe.total_tables || 20);
            const parsedTableNumber = Number(tableNumber);
            if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1 || parsedTableNumber > maxTableCount) {
                return res.status(400).json({ error: `Masa numarası 1-${maxTableCount} aralığında olmalıdır.` });
            }

            // 3. Update User
            await pool.query(
                'UPDATE users SET cafe_id = $1, table_number = $2 WHERE id = $3',
                [id, parsedTableNumber, userId]
            );

            res.json({
                success: true,
                message: 'Giriş başarılı!',
                cafe,
                cafeName: cafe.name,
                table: `MASA${String(parsedTableNumber).padStart(2, '0')}`
            });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Check-in başarısız.' });
        }
    }
};

module.exports = cafeController;
