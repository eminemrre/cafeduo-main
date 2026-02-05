const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { logger } = require('../utils/logger'); // Assuming logger structure

// In-memory fallback (from server.js)
// Note: In a real refactor, we should move MEMORY_USERS to a shared model/service
// For now, we will assume DB usage mostly, or copy the fallback logic if needed.
// To keep it simple, I will focus on DB logic first as per production standards.

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

const generateToken = (user) => {
    return jwt.sign(
        { id: user.id, email: user.email, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// Helper for reCAPTCHA (moved from server.js)
const verifyRecaptcha = async (token) => {
    if (!token) return true;
    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) return true;
        const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`, { method: 'POST' });
        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('reCAPTCHA Error:', error);
        return true;
    }
};

const authController = {
    // REGISTER
    async register(req, res) {
        const { username, email, password, department } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        try {
            // DB Check
            const check = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (check.rows.length > 0) return res.status(400).json({ error: 'E-posta kullanımda.' });

            const hashedPassword = await bcrypt.hash(password, 10);
            const result = await pool.query(
                'INSERT INTO users (username, email, password_hash, points, department) VALUES ($1, $2, $3, 100, $4) RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin"',
                [username, email, hashedPassword, department || '']
            );
            res.json(result.rows[0]);
        } catch (err) {
            console.error('Register error:', err);
            res.status(400).json({ error: 'Kullanıcı oluşturulamadı.' });
            // Fallback logic could go here if needed
        }
    },

    // LOGIN
    async login(req, res) {
        const { email, password, captchaToken } = req.body;

        const isHuman = await verifyRecaptcha(captchaToken);
        if (!isHuman) return res.status(400).json({ error: 'Robot doğrulaması başarısız.' });

        try {
            const result = await pool.query('SELECT id, username, email, password_hash, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id FROM users WHERE email = $1', [email]);

            if (result.rows.length > 0) {
                const user = result.rows[0];
                const match = await bcrypt.compare(password, user.password_hash);

                if (match) {
                    // Daily Bonus Logic (Simplified)
                    const isEligibleForBonus = !user.is_admin && user.role !== 'cafe_admin' && user.role !== 'admin';
                    // ... (Bonus logic omitted for brevity in first pass, should be in Service)

                    delete user.password_hash;
                    const token = generateToken(user);
                    res.json({ user, token });
                } else {
                    res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
                }
            } else {
                res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
            }
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
