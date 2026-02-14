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

const normalizeVerificationCode = (value) => {
    return String(value || '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
};

const buildExpectedVerificationCodes = (cafe, tableNumber) => {
    const normalizedTable = Math.max(1, Math.floor(Number(tableNumber) || 0));
    const tableLabel = `MASA${String(normalizedTable).padStart(2, '0')}`;
    const shortTable = String(normalizedTable);
    const basePins = [cafe?.daily_pin, cafe?.pin]
        .map((value) => normalizeVerificationCode(value))
        .filter(Boolean);
    const uniquePins = Array.from(new Set(basePins));

    const expected = new Set();
    for (const pin of uniquePins) {
        expected.add(pin);
        expected.add(`${pin}-${tableLabel}`);
        expected.add(`${pin}-${shortTable}`);
    }
    return expected;
};

const isVerificationCodeValid = ({ providedCode, cafe, tableNumber }) => {
    const normalizedCode = normalizeVerificationCode(providedCode);
    if (!normalizedCode) return false;
    const expectedCodes = buildExpectedVerificationCodes(cafe, tableNumber);
    return expectedCodes.has(normalizedCode);
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

const getSecondaryLatitude = (cafe) => parseCoordinate(cafe?.secondary_latitude ?? cafe?.secondaryLatitude);
const getSecondaryLongitude = (cafe) => parseCoordinate(cafe?.secondary_longitude ?? cafe?.secondaryLongitude);
const getSecondaryRadius = (cafe, fallbackRadius) =>
    parseRadius(cafe?.secondary_radius ?? cafe?.secondaryRadius, fallbackRadius);

const buildCafeLocationTargets = (cafe) => {
    const targets = [];

    const primaryLatitude = parseCoordinate(cafe?.latitude);
    const primaryLongitude = parseCoordinate(cafe?.longitude);
    const primaryRadius = parseRadius(cafe?.radius, 150);
    if (primaryLatitude !== null && primaryLongitude !== null) {
        targets.push({
            key: 'primary',
            label: 'ana konum',
            latitude: primaryLatitude,
            longitude: primaryLongitude,
            radius: primaryRadius,
        });
    }

    const secondaryLatitude = getSecondaryLatitude(cafe);
    const secondaryLongitude = getSecondaryLongitude(cafe);
    if (secondaryLatitude !== null && secondaryLongitude !== null) {
        targets.push({
            key: 'secondary',
            label: 'ek konum',
            latitude: secondaryLatitude,
            longitude: secondaryLongitude,
            radius: getSecondaryRadius(cafe, primaryRadius),
        });
    }

    return targets;
};

const evaluateDistanceAgainstTargets = ({ latitude, longitude, accuracy, targets }) => {
    const checks = targets.map((target) => {
        const distance = getDistanceFromLatLonInMeters(
            latitude,
            longitude,
            target.latitude,
            target.longitude
        );
        const effectiveRadius = getEffectiveRadius(target.radius, accuracy);

        return {
            ...target,
            distance,
            effectiveRadius,
            within: Number.isFinite(distance) && distance <= effectiveRadius,
        };
    });

    const accepted = checks.find((check) => check.within) || null;
    const nearest = checks
        .filter((check) => Number.isFinite(check.distance))
        .sort((a, b) => a.distance - b.distance)[0] || null;

    return { checks, accepted, nearest };
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
        const body = req.body || {};
        const { latitude, longitude, radius } = body;

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

        const hasSecondaryLatitude = Object.prototype.hasOwnProperty.call(body, 'secondaryLatitude')
            || Object.prototype.hasOwnProperty.call(body, 'secondary_latitude');
        const hasSecondaryLongitude = Object.prototype.hasOwnProperty.call(body, 'secondaryLongitude')
            || Object.prototype.hasOwnProperty.call(body, 'secondary_longitude');
        const hasSecondaryRadius = Object.prototype.hasOwnProperty.call(body, 'secondaryRadius')
            || Object.prototype.hasOwnProperty.call(body, 'secondary_radius');
        const hasSecondaryUpdate = hasSecondaryLatitude || hasSecondaryLongitude || hasSecondaryRadius;

        const secondaryLatitudeRaw = hasSecondaryLatitude
            ? (body.secondaryLatitude ?? body.secondary_latitude)
            : undefined;
        const secondaryLongitudeRaw = hasSecondaryLongitude
            ? (body.secondaryLongitude ?? body.secondary_longitude)
            : undefined;
        const secondaryRadiusRaw = hasSecondaryRadius
            ? (body.secondaryRadius ?? body.secondary_radius)
            : undefined;

        const secondaryLatitudeEmpty = secondaryLatitudeRaw === null || secondaryLatitudeRaw === '';
        const secondaryLongitudeEmpty = secondaryLongitudeRaw === null || secondaryLongitudeRaw === '';
        const secondaryRadiusEmpty = secondaryRadiusRaw === null || secondaryRadiusRaw === '';

        let secondaryLatitudeValue = null;
        let secondaryLongitudeValue = null;
        let secondaryRadiusValue = null;

        if (hasSecondaryUpdate) {
            if (hasSecondaryRadius && !hasSecondaryLatitude && !hasSecondaryLongitude) {
                return res.status(400).json({ error: 'Ek yarıçap için ek enlem ve boylam da girin.' });
            }

            if ((secondaryLatitudeEmpty && !secondaryLongitudeEmpty) || (!secondaryLatitudeEmpty && secondaryLongitudeEmpty)) {
                return res.status(400).json({ error: 'Ek konum için enlem ve boylam birlikte girilmelidir.' });
            }

            const clearingSecondary = secondaryLatitudeEmpty && secondaryLongitudeEmpty;
            if (clearingSecondary) {
                if (hasSecondaryRadius && !secondaryRadiusEmpty) {
                    return res.status(400).json({ error: 'Ek konumu temizlerken yarıçap değeri gönderilemez.' });
                }
                secondaryLatitudeValue = null;
                secondaryLongitudeValue = null;
                secondaryRadiusValue = null;
            } else {
                const parsedSecondaryLatitude = parseDecimal(secondaryLatitudeRaw);
                if (!Number.isFinite(parsedSecondaryLatitude) || parsedSecondaryLatitude < -90 || parsedSecondaryLatitude > 90) {
                    return res.status(400).json({ error: 'Ek konum enlem değeri -90 ile 90 arasında olmalıdır.' });
                }

                const parsedSecondaryLongitude = parseDecimal(secondaryLongitudeRaw);
                if (!Number.isFinite(parsedSecondaryLongitude) || parsedSecondaryLongitude < -180 || parsedSecondaryLongitude > 180) {
                    return res.status(400).json({ error: 'Ek konum boylam değeri -180 ile 180 arasında olmalıdır.' });
                }

                let parsedSecondaryRadius = parsedRadius;
                if (hasSecondaryRadius && !secondaryRadiusEmpty) {
                    parsedSecondaryRadius = parseDecimal(secondaryRadiusRaw);
                    if (!Number.isFinite(parsedSecondaryRadius) || parsedSecondaryRadius < 10 || parsedSecondaryRadius > 5000) {
                        return res.status(400).json({ error: 'Ek konum yarıçapı 10-5000 metre aralığında olmalıdır.' });
                    }
                }

                secondaryLatitudeValue = parsedSecondaryLatitude;
                secondaryLongitudeValue = parsedSecondaryLongitude;
                secondaryRadiusValue = Math.round(parsedSecondaryRadius);
            }
        }

        try {
            const updates = [
                'latitude = $1',
                'longitude = $2',
                'radius = $3',
            ];
            const values = [parsedLatitude, parsedLongitude, Math.round(parsedRadius)];

            if (hasSecondaryUpdate) {
                updates.push(`secondary_latitude = $${values.length + 1}`);
                values.push(secondaryLatitudeValue);
                updates.push(`secondary_longitude = $${values.length + 1}`);
                values.push(secondaryLongitudeValue);
                updates.push(`secondary_radius = $${values.length + 1}`);
                values.push(secondaryRadiusValue);
            }

            values.push(id);

            const result = await pool.query(
                `UPDATE cafes
                 SET ${updates.join(', ')}
                 WHERE id = $${values.length}
                 RETURNING id, name, latitude, longitude, radius, secondary_latitude, secondary_longitude, secondary_radius`,
                values
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
        const { latitude, longitude, tableNumber, accuracy, tableVerificationCode } = req.body;
        const userId = req.user.id;

        const parsedLatitude = parseDecimal(latitude);
        const parsedLongitude = parseDecimal(longitude);
        const parsedAccuracy = parseAccuracy(accuracy);
        const hasLocation = Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude);
        const normalizedVerificationCode = normalizeVerificationCode(tableVerificationCode);

        if (!(await isDbConnected())) {
            const cafe = FALLBACK_CAFES.find((item) => Number(item.id) === Number(id));
            if (!cafe) return res.status(404).json({ error: 'Kafe bulunamadı.' });

            const maxTableCount = Number(cafe.table_count || 20);
            const parsedTableNumber = Number(tableNumber);
            if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1 || parsedTableNumber > maxTableCount) {
                return res.status(400).json({ error: `Masa numarası 1-${maxTableCount} aralığında olmalıdır.` });
            }

            const locationTargets = buildCafeLocationTargets(cafe);
            if (hasLocation) {
                if (locationTargets.length === 0) {
                    return res.status(400).json({
                        error: 'Bu kafe için konum doğrulaması henüz ayarlanmadı. Lütfen kafe yetkilisine bildirin.',
                    });
                }

                const { accepted, nearest } = evaluateDistanceAgainstTargets({
                    latitude: parsedLatitude,
                    longitude: parsedLongitude,
                    accuracy: parsedAccuracy,
                    targets: locationTargets,
                });

                if (!accepted) {
                    const nearestDistance = nearest && Number.isFinite(nearest.distance)
                        ? `${Math.round(nearest.distance)} metre`
                        : 'belirlenemeyen bir mesafe';
                    const nearestRadius = nearest ? nearest.effectiveRadius : getEffectiveRadius(150, parsedAccuracy);
                    const nearestLabel = nearest ? ` (${nearest.label})` : '';
                    return res.status(400).json({
                        error: `Kafeden çok uzaktasınız. Yaklaşık ${nearestDistance}${nearestLabel} görünüyorsunuz, doğrulama sınırı ${nearestRadius} metre.`,
                    });
                }
            } else if (!isVerificationCodeValid({
                providedCode: normalizedVerificationCode,
                cafe,
                tableNumber: parsedTableNumber,
            })) {
                return res.status(400).json({
                    error: 'Konum doğrulanamadı. Masa doğrulama kodu geçersiz.',
                });
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

            const maxTableCount = Number(cafe.table_count || cafe.total_tables || 20);
            const parsedTableNumber = Number(tableNumber);
            if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1 || parsedTableNumber > maxTableCount) {
                return res.status(400).json({ error: `Masa numarası 1-${maxTableCount} aralığında olmalıdır.` });
            }

            if (hasLocation) {
                // 2. Location Check (Geofencing)
                const locationTargets = buildCafeLocationTargets(cafe);
                if (locationTargets.length === 0) {
                    return res.status(400).json({
                        error: 'Bu kafe için konum doğrulaması henüz ayarlanmadı. Lütfen kafe yetkilisine bildirin.',
                    });
                }

                const { accepted, nearest } = evaluateDistanceAgainstTargets({
                    latitude: parsedLatitude,
                    longitude: parsedLongitude,
                    accuracy: parsedAccuracy,
                    targets: locationTargets,
                });

                if (!accepted) {
                    const distanceLabel = nearest && Number.isFinite(nearest.distance)
                        ? `${Math.round(nearest.distance)} metre`
                        : 'belirlenemeyen bir mesafe';
                    const nearestRadius = nearest ? nearest.effectiveRadius : getEffectiveRadius(150, parsedAccuracy);
                    const nearestLabel = nearest ? ` (${nearest.label})` : '';
                    return res.status(400).json({
                        error: `Kafeden çok uzaktasınız. Yaklaşık ${distanceLabel}${nearestLabel} görünüyorsunuz, doğrulama sınırı ${nearestRadius} metre.`,
                    });
                }
            } else if (!isVerificationCodeValid({
                providedCode: normalizedVerificationCode,
                cafe,
                tableNumber: parsedTableNumber,
            })) {
                return res.status(400).json({
                    error: 'Konum alınamadı. Giriş için konum izni verin veya geçerli masa doğrulama kodu girin.',
                });
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
