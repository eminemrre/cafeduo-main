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

const hasCafeManagementAccess = (user, cafeId) => {
    if (!user) return false;
    if (user.role === 'admin' || user.isAdmin) return true;
    if (user.role !== 'cafe_admin') return false;
    return Number(user.cafe_id) === Number(cafeId);
};

const parseRadius = (value, fallback = 150) => {
    const parsed = parseDecimal(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};

const parseDecimal = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : Number.NaN;
    }
    if (value === null || value === undefined) {
        return Number.NaN;
    }
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) {
        return Number.NaN;
    }
    return Number(normalized);
};

const parseCoordinate = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = parseDecimal(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseAccuracy = (value) => {
    const parsed = parseDecimal(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return null;
    }
    // Desktop/IP tabanlı ölçümlerde doğruluk değeri yüksek gelebilir.
    // Tamamen serbest bırakmak yerine kontrollü bir üst sınır uyguluyoruz.
    return Math.min(parsed, 1500);
};

const getEffectiveRadius = (baseRadius, clientAccuracy) => {
    const safeBase = Math.max(40, Math.round(Number(baseRadius) || 150));
    const defaultDriftBuffer = 120; // meters
    if (clientAccuracy === null) {
        return Math.min(2500, safeBase + defaultDriftBuffer);
    }
    const accuracyBuffer = Math.min(1200, Math.max(50, Math.round(clientAccuracy * 0.9)));
    return Math.min(2500, safeBase + accuracyBuffer);
};

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

        if (!hasCafeManagementAccess(req.user, id)) {
            return res.status(403).json({ error: 'Bu kafe için işlem yetkiniz yok.' });
        }

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

    // UPDATE CAFE LOCATION (Protected: Cafe Admin)
    async updateLocation(req, res) {
        const { id } = req.params;
        const { latitude, longitude, radius } = req.body || {};

        if (!hasCafeManagementAccess(req.user, id)) {
            return res.status(403).json({ error: 'Bu kafe için işlem yetkiniz yok.' });
        }

        const parsedLatitude = parseDecimal(latitude);
        const parsedLongitude = parseDecimal(longitude);
        const parsedRadius = parseDecimal(radius);

        if (!Number.isFinite(parsedLatitude) || parsedLatitude < -90 || parsedLatitude > 90) {
            return res.status(400).json({ error: 'Enlem değeri -90 ile 90 arasında olmalıdır.' });
        }

        if (!Number.isFinite(parsedLongitude) || parsedLongitude < -180 || parsedLongitude > 180) {
            return res.status(400).json({ error: 'Boylam değeri -180 ile 180 arasında olmalıdır.' });
        }

        if (!Number.isFinite(parsedRadius) || parsedRadius < 10 || parsedRadius > 5000) {
            return res.status(400).json({ error: 'Yarıçap 10-5000 metre aralığında olmalıdır.' });
        }

        try {
            const result = await pool.query(
                'UPDATE cafes SET latitude = $1, longitude = $2, radius = $3 WHERE id = $4 RETURNING id, name, latitude, longitude, radius',
                [parsedLatitude, parsedLongitude, Math.round(parsedRadius), id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Kafe bulunamadı.' });
            }

            await clearCache(`cache:/api/cafes*`);

            return res.json({
                success: true,
                message: 'Kafe konumu güncellendi.',
                cafe: result.rows[0],
            });
        } catch (err) {
            console.error('updateLocation error:', err);
            return res.status(500).json({ error: 'Kafe konumu güncellenemedi.' });
        }
    },

    // CHECK-IN (Location based)
    async checkIn(req, res) {
        const { id } = req.params;
        const { latitude, longitude, tableNumber, accuracy } = req.body;
        const userId = req.user.id;

        const parsedLatitude = parseDecimal(latitude);
        const parsedLongitude = parseDecimal(longitude);
        const parsedAccuracy = parseAccuracy(accuracy);
        if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
            return res.status(400).json({ error: 'Kafe doğrulaması için konum izni gerekli.' });
        }

        if (!(await isDbConnected())) {
            const cafe = FALLBACK_CAFES.find((item) => Number(item.id) === Number(id));
            if (!cafe) return res.status(404).json({ error: 'Kafe bulunamadı.' });

            const fallbackRadius = parseRadius(cafe.radius, 150);
            const effectiveRadius = getEffectiveRadius(fallbackRadius, parsedAccuracy);
            const distance = getDistanceFromLatLonInMeters(
                parsedLatitude,
                parsedLongitude,
                Number(cafe.latitude),
                Number(cafe.longitude)
            );
            if (Number.isFinite(distance) && distance > effectiveRadius) {
                return res.status(400).json({
                    error: `Kafeden çok uzaktasınız. Yaklaşık ${Math.round(distance)} metre uzaktasınız, doğrulama sınırı ${effectiveRadius} metre.`,
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
            const cafeLatitude = parseCoordinate(cafe.latitude);
            const cafeLongitude = parseCoordinate(cafe.longitude);
            if (cafeLatitude === null || cafeLongitude === null) {
                return res.status(400).json({
                    error: 'Bu kafe için konum doğrulaması henüz ayarlanmadı. Lütfen kafe yetkilisine bildirin.',
                });
            }

            const radius = parseRadius(cafe.radius, 150);
            const effectiveRadius = getEffectiveRadius(radius, parsedAccuracy);
            const distance = getDistanceFromLatLonInMeters(
                parsedLatitude,
                parsedLongitude,
                cafeLatitude,
                cafeLongitude
            );

            if (!Number.isFinite(distance) || distance > effectiveRadius) {
                const distanceLabel = Number.isFinite(distance) ? `${Math.round(distance)} metre` : 'belirlenemeyen bir mesafede';
                return res.status(400).json({
                    error: `Kafeden çok uzaktasınız. Yaklaşık ${distanceLabel} görünüyorsunuz, doğrulama sınırı ${effectiveRadius} metre.`,
                });
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
