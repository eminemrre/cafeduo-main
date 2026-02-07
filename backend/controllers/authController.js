const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool, isDbConnected } = require('../db');
const { logger } = require('../utils/logger'); // Assuming logger structure
const memoryState = require('../store/memoryState');

const JWT_SECRET = process.env.JWT_SECRET;
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

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

const generateToken = (user) => {
    const gamesPlayed = Number(user.gamesPlayed ?? user.games_played ?? 0);
    const wins = Number(user.wins ?? 0);
    const points = Number(user.points ?? 0);
    const isAdmin = Boolean(user.isAdmin ?? user.is_admin ?? false);
    const cafeId = user.cafe_id ?? null;
    const tableNumber = user.table_number ?? null;

    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role || 'user',
            isAdmin,
            points,
            wins,
            gamesPlayed,
            cafe_id: cafeId,
            table_number: tableNumber,
            department: user.department || '',
        },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
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
        console.error('reCAPTCHA Error:', error);
        // Secret key tanımlıysa ve doğrulama servisine erişilemediyse fail-closed davran.
        return false;
    }
};

const authController = {
    // REGISTER
    async register(req, res) {
        const { username, email, password, department } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        const normalizedUsername = String(username).trim();
        const normalizedEmail = String(email).trim().toLowerCase();
        const safeDepartment = String(department || '').trim().slice(0, 120);
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;

        if (!usernamePattern.test(normalizedUsername)) {
            return res.status(400).json({ error: 'Kullanıcı adı 3-20 karakter ve sadece harf/rakam/_ içermelidir.' });
        }
        if (!emailPattern.test(normalizedEmail)) {
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
            console.error('Register error:', err);
            if (err?.code === '23505') {
                return res.status(400).json({ error: 'E-posta kullanımda.' });
            }
            return res.status(400).json({ error: 'Kullanıcı oluşturulamadı.' });
        }
    },

    // LOGIN
    async login(req, res) {
        const { email, password, captchaToken } = req.body;
        const normalizedEmail = String(email || '').trim().toLowerCase();
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

            const match = memoryUser.password_hash
                ? await bcrypt.compare(normalizedPassword, memoryUser.password_hash)
                : String(memoryUser.password || '') === normalizedPassword;
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
            return res.json({ user: toPublicUser(memoryUser), token });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ error: 'Sunucu hatası.' });
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
