const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { pool, isDbConnected } = require('../db');
const logger = require('../utils/logger');
const memoryState = require('../store/memoryState');
const { sendPasswordResetEmail } = require('../services/emailService');
const redisClient = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || 30);
const PASSWORD_RESET_TOKEN_TTL_MS = Math.max(5, PASSWORD_RESET_TOKEN_TTL_MINUTES) * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const USER_SELECT_FIELDS = `
    id,
    username,
    email,
    points,
    wins,
    games_played as "gamesPlayed",
    department,
    is_admin as "isAdmin",
    role,
    cafe_id,
    table_number,
    avatar_url
`;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const memoryPasswordResetTokens = [];

const hashResetToken = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

const buildPasswordResetUrl = (rawToken) => {
    const corsOrigin = String(process.env.CORS_ORIGIN || '')
        .split(',')
        .map((origin) => origin.trim())
        .find((origin) => Boolean(origin) && origin !== '*');
    const baseUrl =
        String(
            process.env.APP_BASE_URL ||
            process.env.PUBLIC_APP_URL ||
            process.env.FRONTEND_URL ||
            corsOrigin ||
            'http://localhost:5173'
        )
            .trim()
            .replace(/\/+$/, '') || 'http://localhost:5173';
    return `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const splitEmailParts = (email) => {
    const normalized = normalizeEmail(email);
    const [localRaw, domainRaw] = normalized.split('@');
    const local = String(localRaw || '').trim();
    const domain = String(domainRaw || '').trim();
    if (!local || !domain) return null;
    return { local, domain };
};

const canonicalizeEmail = (email) => {
    const parts = splitEmailParts(email);
    if (!parts) return normalizeEmail(email);

    let local = parts.local;
    let domain = parts.domain;

    if (domain === 'googlemail.com') {
        domain = 'gmail.com';
    }

    if (domain === 'gmail.com') {
        local = local.split('+')[0].replace(/\./g, '');
    }

    return `${local}@${domain}`;
};

const buildEmailLookupVariants = (email) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return [];

    const variants = new Set([normalized]);
    const canonical = canonicalizeEmail(normalized);
    if (canonical) variants.add(canonical);

    const parts = splitEmailParts(normalized);
    if (parts && (parts.domain === 'gmail.com' || parts.domain === 'googlemail.com')) {
        const gmailDomain = parts.domain === 'googlemail.com' ? 'gmail.com' : 'googlemail.com';
        const swapped = `${parts.local}@${gmailDomain}`;
        variants.add(swapped);
        variants.add(canonicalizeEmail(swapped));
    }

    return Array.from(variants).filter(Boolean);
};

const findMemoryUserByEmail = (email) => {
    const candidates = new Set(buildEmailLookupVariants(email));
    const canonicalInput = canonicalizeEmail(email);
    return memoryState.users.find((user) => {
        const raw = normalizeEmail(user?.email);
        return candidates.has(raw) || canonicalizeEmail(raw) === canonicalInput;
    }) || null;
};

const findDbUserByEmail = async (email) => {
    const variants = buildEmailLookupVariants(email);
    if (variants.length === 0) return null;

    const directLookup = await pool.query(
        'SELECT id, email, username FROM users WHERE LOWER(TRIM(email)) = ANY($1::text[]) LIMIT 1',
        [variants]
    );
    if (directLookup.rows.length > 0) {
        return directLookup.rows[0];
    }

    const parts = splitEmailParts(email);
    if (!parts || !['gmail.com', 'googlemail.com'].includes(parts.domain)) {
        return null;
    }

    const canonicalLocal = parts.local.split('+')[0].replace(/\./g, '');
    const gmailLookup = await pool.query(
        `SELECT id, email, username
         FROM users
         WHERE split_part(LOWER(TRIM(email)), '@', 2) IN ('gmail.com', 'googlemail.com')
           AND REPLACE(split_part(split_part(LOWER(TRIM(email)), '@', 1), '+', 1), '.', '') = $1
         LIMIT 1`,
        [canonicalLocal]
    );

    return gmailLookup.rows[0] || null;
};

const toSafeUsername = (name, fallbackEmail) => {
    const fromName = String(name || '')
        .normalize('NFKD')
        .replace(/[^\w]/g, '');
    const fromEmail = String(fallbackEmail || '')
        .split('@')[0]
        .replace(/[^\w]/g, '');
    const value = (fromName || fromEmail || 'GoogleUser').slice(0, 20);
    if (value.length >= 3) return value;
    return `${value || 'usr'}${Math.floor(Math.random() * 900 + 100)}`.slice(0, 20);
};

const parseAdminEmails = (emailsValue, fallback = []) => {
    const source = emailsValue || fallback.join(',');
    return source
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
};
const BOOTSTRAP_ADMIN_EMAILS = parseAdminEmails(
    process.env.BOOTSTRAP_ADMIN_EMAILS || process.env.ADMIN_EMAILS,
    ['emin3619@gmail.com']
);
const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

/**
 * Generate JWT token with minimal payload for security
 * Only includes essential claims: id, role, isAdmin
 * All other user data is fetched from database on each request
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            role: user.role || 'user',
            isAdmin: Boolean(user.isAdmin ?? user.is_admin ?? false),
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const buildAuthCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
    path: '/',
    domain: process.env.COOKIE_DOMAIN || undefined,
});

const setAuthCookie = (res, token) => {
    res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions());
};

const clearAuthCookie = (res) => {
    res.clearCookie(AUTH_COOKIE_NAME, buildAuthCookieOptions());
};

const toPublicUser = (user) => {
    const safeUser = { ...user };
    if (safeUser.games_played !== undefined && safeUser.gamesPlayed === undefined) {
        safeUser.gamesPlayed = safeUser.games_played;
    }
    if (safeUser.is_admin !== undefined && safeUser.isAdmin === undefined) {
        safeUser.isAdmin = Boolean(safeUser.is_admin);
    }
    delete safeUser.password;
    delete safeUser.password_hash;
    return safeUser;
};

// Helper for reCAPTCHA (moved from server.js)
const verifyRecaptcha = async (token) => {
    if (!token) return true;
    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) return true;
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`, { method: 'POST' });
        const data = await response.json();
        return Boolean(data.success);
    } catch (error) {
        logger.error('reCAPTCHA Error:', error);
        // Secret key tanımlıysa ve doğrulama servisine erişilemediyse fail-closed davran.
        return false;
    }
};

const responseForgotPassword = {
    success: true,
    message:
        'Eğer e-posta adresi sistemde kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.',
};

const authController = {
    // REGISTER
    async register(req, res) {
        const { username, email, password, department } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        const normalizedUsername = String(username).trim();
        const normalizedEmail = normalizeEmail(email);
        const safeDepartment = String(department || '').trim().slice(0, 120);

        if (!USERNAME_PATTERN.test(normalizedUsername)) {
            return res.status(400).json({ error: 'Kullanıcı adı 3-20 karakter ve sadece harf/rakam/_ içermelidir.' });
        }
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
        }
        if (String(password).length < 6 || String(password).length > 72) {
            return res.status(400).json({ error: 'Şifre 6-72 karakter aralığında olmalıdır.' });
        }

        try {
            const shouldBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(normalizedEmail);
            const hashedPassword = await bcrypt.hash(password, 10);

            if (await isDbConnected()) {
                const check = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
                if (check.rows.length > 0) return res.status(400).json({ error: 'E-posta kullanımda.' });

                const result = await pool.query(
                    `INSERT INTO users (username, email, password_hash, points, department, role, is_admin) 
                     VALUES ($1, $2, $3, 100, $4, $5, $6) 
                     RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number`,
                    [
                        normalizedUsername,
                        normalizedEmail,
                        hashedPassword,
                        safeDepartment,
                        shouldBootstrapAdmin ? 'admin' : 'user',
                        shouldBootstrapAdmin
                    ]
                );
                return res.json(toPublicUser(result.rows[0]));
            }

            const existing = memoryState.users.find(
                (u) => String(u.email || '').trim().toLowerCase() === normalizedEmail
            );
            if (existing) {
                return res.status(400).json({ error: 'E-posta kullanımda.' });
            }

            const nextId =
                (memoryState.users.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) || 0) + 1;
            const memoryUser = {
                id: nextId,
                username: normalizedUsername,
                email: normalizedEmail,
                password_hash: hashedPassword,
                points: 100,
                wins: 0,
                gamesPlayed: 0,
                department: safeDepartment,
                role: shouldBootstrapAdmin ? 'admin' : 'user',
                isAdmin: shouldBootstrapAdmin,
                cafe_id: null,
                table_number: null,
            };
            memoryState.users.unshift(memoryUser);
            return res.json(toPublicUser(memoryUser));
        } catch (err) {
            logger.error('Register error:', err);
            if (err?.code === '23505') {
                return res.status(400).json({ error: 'E-posta kullanımda.' });
            }
            return res.status(400).json({ error: 'Kullanıcı oluşturulamadı.' });
        }
    },

    // LOGIN
    async login(req, res) {
        const { email, password, captchaToken } = req.body;
        const normalizedEmail = normalizeEmail(email);
        const normalizedPassword = String(password || '');

        if (!normalizedEmail || !normalizedPassword) {
            return res.status(400).json({ error: 'E-posta ve şifre zorunludur.' });
        }
        if (normalizedPassword.length < 6 || normalizedPassword.length > 128) {
            return res.status(400).json({ error: 'Geçersiz şifre formatı.' });
        }

        const isHuman = await verifyRecaptcha(captchaToken);
        if (!isHuman) return res.status(400).json({ error: 'Robot doğrulaması başarısız.' });

        try {
            if (await isDbConnected()) {
                const result = await pool.query(
                    'SELECT id, username, email, password_hash, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number FROM users WHERE LOWER(email) = $1',
                    [normalizedEmail]
                );

                if (result.rows.length > 0) {
                    let user = result.rows[0];
                    const match = await bcrypt.compare(normalizedPassword, user.password_hash);

                    if (match) {
                        const shouldBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(normalizedEmail);

                        if (shouldBootstrapAdmin && (!user.isAdmin || user.role !== 'admin')) {
                            const promoted = await pool.query(
                                `UPDATE users
                                 SET role = 'admin',
                                     is_admin = true,
                                     cafe_id = NULL
                                 WHERE id = $1
                                 RETURNING id, username, email, password_hash, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number`,
                                [user.id]
                            );
                            if (promoted.rows.length > 0) {
                                user = promoted.rows[0];
                                logger.info('Bootstrap admin promoted on login', { email: normalizedEmail });
                            }
                        }

                        const token = generateToken(user);
                        setAuthCookie(res, token);
                        return res.json({ user: toPublicUser(user), token });
                    }
                    return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
                }

                return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
            }

            const memoryUser = memoryState.users.find(
                (u) => String(u.email || '').trim().toLowerCase() === normalizedEmail
            );
            if (!memoryUser) {
                return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
            }

            // SECURITY: Never use plain-text password comparison
            const match = memoryUser.password_hash
                ? await bcrypt.compare(normalizedPassword, memoryUser.password_hash)
                : false;
            if (!match) {
                return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
            }

            const shouldBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(normalizedEmail);
            if (shouldBootstrapAdmin) {
                memoryUser.role = 'admin';
                memoryUser.isAdmin = true;
                memoryUser.cafe_id = null;
            }

            const token = generateToken(memoryUser);
            setAuthCookie(res, token);
            return res.json({ user: toPublicUser(memoryUser), token });
        } catch (err) {
            logger.error('Login error:', err);
            res.status(500).json({ error: 'Sunucu hatası.' });
        }
    },

    // GOOGLE LOGIN
    async googleLogin(req, res) {
        const idToken = String(req.body?.token || '').trim();
        if (!idToken) {
            return res.status(400).json({ error: 'Google token zorunludur.' });
        }
        if (!GOOGLE_CLIENT_ID || !googleClient) {
            return res.status(503).json({ error: 'Google giriş şu anda yapılandırılmamış.' });
        }

        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload() || {};
            const email = normalizeEmail(payload.email);
            if (!email) {
                return res.status(400).json({ error: 'Google hesabından e-posta alınamadı.' });
            }

            const shouldBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS.includes(email);
            const avatarUrl = typeof payload.picture === 'string' ? payload.picture : null;
            const profileName = toSafeUsername(payload.name, email);

            if (await isDbConnected()) {
                const found = await pool.query(
                    `SELECT ${USER_SELECT_FIELDS} FROM users WHERE LOWER(email) = $1 LIMIT 1`,
                    [email]
                );

                let user;
                if (found.rows.length > 0) {
                    const existing = found.rows[0];
                    const nextRole = shouldBootstrapAdmin ? 'admin' : existing.role || 'user';
                    const nextIsAdmin = shouldBootstrapAdmin ? true : Boolean(existing.isAdmin);
                    const updated = await pool.query(
                        `UPDATE users
                         SET avatar_url = COALESCE($1, avatar_url),
                             role = $2,
                             is_admin = $3,
                             cafe_id = NULL,
                             table_number = NULL
                         WHERE id = $4
                         RETURNING ${USER_SELECT_FIELDS}`,
                        [avatarUrl, nextRole, nextIsAdmin, existing.id]
                    );
                    user = updated.rows[0];
                } else {
                    const randomPassword = crypto.randomBytes(24).toString('hex');
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    const inserted = await pool.query(
                        `INSERT INTO users (username, email, password_hash, points, department, role, is_admin, avatar_url)
                         VALUES ($1, $2, $3, 100, $4, $5, $6, $7)
                         RETURNING ${USER_SELECT_FIELDS}`,
                        [
                            profileName,
                            email,
                            hashedPassword,
                            'Google User',
                            shouldBootstrapAdmin ? 'admin' : 'user',
                            shouldBootstrapAdmin,
                            avatarUrl,
                        ]
                    );
                    user = inserted.rows[0];
                }

                const token = generateToken(user);
                setAuthCookie(res, token);
                return res.json({ user: toPublicUser(user), token });
            }

            let user = memoryState.users.find((u) => normalizeEmail(u.email) === email);
            if (!user) {
                const nextId =
                    (memoryState.users.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) || 0) + 1;
                user = {
                    id: nextId,
                    username: profileName,
                    email,
                    password_hash: await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10),
                    points: 100,
                    wins: 0,
                    gamesPlayed: 0,
                    department: 'Google User',
                    role: shouldBootstrapAdmin ? 'admin' : 'user',
                    isAdmin: shouldBootstrapAdmin,
                    cafe_id: null,
                    table_number: null,
                    avatar_url: avatarUrl,
                };
                memoryState.users.unshift(user);
            } else {
                user.avatar_url = avatarUrl || user.avatar_url;
                user.cafe_id = null;
                user.table_number = null;
                if (shouldBootstrapAdmin) {
                    user.role = 'admin';
                    user.isAdmin = true;
                }
            }

            const token = generateToken(user);
            setAuthCookie(res, token);
            return res.json({ user: toPublicUser(user), token });
        } catch (error) {
            logger.error('Google auth failed', error);
            return res.status(401).json({ error: 'Google doğrulaması başarısız.' });
        }
    },

    // FORGOT PASSWORD
    async forgotPassword(req, res) {
        const normalizedEmail = normalizeEmail(req.body?.email);
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
        }

        try {
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = hashResetToken(rawToken);
            const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

            if (await isDbConnected()) {
                const user = await findDbUserByEmail(normalizedEmail);
                if (!user) {
                    return res.json(responseForgotPassword);
                }

                await pool.query(
                    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, request_ip, user_agent)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [
                        user.id,
                        tokenHash,
                        expiresAt,
                        String(req.ip || '').slice(0, 64),
                        String(req.headers['user-agent'] || '').slice(0, 255),
                    ]
                );

                const resetUrl = buildPasswordResetUrl(rawToken);
                try {
                    await sendPasswordResetEmail({
                        to: user.email,
                        username: user.username,
                        resetUrl,
                        expiresInMinutes: Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60000),
                    });
                } catch (mailError) {
                    logger.error('forgotPassword e-mail send failed', {
                        userId: user.id,
                        email: user.email,
                        error: mailError?.message || String(mailError),
                    });
                }
                return res.json(responseForgotPassword);
            }

            const memoryUser = findMemoryUserByEmail(normalizedEmail);
            if (!memoryUser) {
                return res.json(responseForgotPassword);
            }

            memoryPasswordResetTokens.push({
                userId: memoryUser.id,
                tokenHash,
                expiresAt: expiresAt.getTime(),
                usedAt: null,
            });

            const resetUrl = buildPasswordResetUrl(rawToken);
            try {
                await sendPasswordResetEmail({
                    to: memoryUser.email,
                    username: memoryUser.username,
                    resetUrl,
                    expiresInMinutes: Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60000),
                });
            } catch (mailError) {
                logger.error('forgotPassword e-mail send failed (memory mode)', {
                    userId: memoryUser.id,
                    email: memoryUser.email,
                    error: mailError?.message || String(mailError),
                });
            }

            return res.json(responseForgotPassword);
        } catch (error) {
            logger.error('forgotPassword flow failed', error);
            return res.json(responseForgotPassword);
        }
    },

    // RESET PASSWORD
    async resetPassword(req, res) {
        const token = String(req.body?.token || '').trim();
        const nextPassword = String(req.body?.password || '');

        if (!token || token.length < 32) {
            return res.status(400).json({ error: 'Geçersiz veya eksik sıfırlama bağlantısı.' });
        }
        if (nextPassword.length < 6 || nextPassword.length > 72) {
            return res.status(400).json({ error: 'Şifre 6-72 karakter aralığında olmalıdır.' });
        }

        const tokenHash = hashResetToken(token);

        try {
            if (await isDbConnected()) {
                const lookup = await pool.query(
                    `SELECT id, user_id
                     FROM password_reset_tokens
                     WHERE token_hash = $1
                       AND used_at IS NULL
                       AND expires_at > NOW()
                     ORDER BY created_at DESC
                     LIMIT 1`,
                    [tokenHash]
                );

                if (lookup.rows.length === 0) {
                    return res.status(400).json({ error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş.' });
                }

                const resetRow = lookup.rows[0];
                const hashedPassword = await bcrypt.hash(nextPassword, 10);
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
                        hashedPassword,
                        resetRow.user_id,
                    ]);
                    await client.query(
                        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
                        [resetRow.user_id]
                    );
                    await client.query('COMMIT');
                } catch (transactionError) {
                    await client.query('ROLLBACK');
                    throw transactionError;
                } finally {
                    client.release();
                }

                return res.json({
                    success: true,
                    message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
                });
            }

            const now = Date.now();
            const memoryToken = [...memoryPasswordResetTokens]
                .reverse()
                .find(
                    (entry) =>
                        entry.tokenHash === tokenHash &&
                        entry.usedAt === null &&
                        Number(entry.expiresAt) > now
                );

            if (!memoryToken) {
                return res.status(400).json({ error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş.' });
            }

            const userIndex = memoryState.users.findIndex(
                (item) => Number(item.id) === Number(memoryToken.userId)
            );
            if (userIndex < 0) {
                return res.status(400).json({ error: 'Sıfırlama bağlantısı geçersiz veya süresi dolmuş.' });
            }

            memoryState.users[userIndex].password_hash = await bcrypt.hash(nextPassword, 10);
            const usedAt = Date.now();
            memoryPasswordResetTokens.forEach((entry) => {
                if (Number(entry.userId) === Number(memoryToken.userId) && entry.usedAt === null) {
                    entry.usedAt = usedAt;
                }
            });

            return res.json({
                success: true,
                message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
            });
        } catch (error) {
            logger.error('resetPassword flow failed', error);
            return res.status(500).json({ error: 'Şifre sıfırlama işlemi tamamlanamadı.' });
        }
    },

    // LOGOUT
    async logout(req, res) {
        const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
        const authHeader = req.headers['authorization'];
        const isBearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
        const token = cookieToken || (isBearer ? authHeader.slice(7).trim() : null);

        if (!token) {
            return res.status(400).json({ error: 'Token required for logout.' });
        }

        try {
            // Decode token to get expiry time (without verification, we just need the exp)
            const decoded = jwt.decode(token);
            
            if (decoded && decoded.exp) {
                const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
                
                // Only blacklist if token hasn't expired yet
                if (expiresIn > 0) {
                    if (redisClient && redisClient.status === 'ready') {
                        // Add to Redis blacklist with TTL = token's remaining lifetime
                        await redisClient.setex(`blacklist:token:${token}`, expiresIn, '1');
                        logger.info('Token blacklisted', {
                            userId: decoded.id,
                            expiresIn,
                            method: 'redis'
                        });
                    } else {
                        // Fallback: in-memory blacklist (not recommended for production)
                        if (!global.tokenBlacklist) {
                            global.tokenBlacklist = new Map();
                        }
                        global.tokenBlacklist.set(token, decoded.exp);
                        logger.info('Token blacklisted (in-memory)', {
                            userId: decoded.id,
                            expiresIn,
                            method: 'memory'
                        });
                    }
                }
            }

            clearAuthCookie(res);
            return res.json({
                success: true,
                message: 'Logged out successfully.'
            });
        } catch (error) {
            logger.error('Logout error:', error);
            clearAuthCookie(res);
            // Still return success - client should clear local token regardless
            return res.json({
                success: true,
                message: 'Logged out successfully.'
            });
        }
    },

    // GET ME
    async getMe(req, res) {
        const user = req.user;
        // Format table_number for frontend (db stores int, frontend needs 'MASAxx')
        if (user.table_number && !isNaN(user.table_number)) {
            user.table_number = `MASA${user.table_number.toString().padStart(2, '0')}`;
        }
        res.json(user);
    }
};

module.exports = authController;
