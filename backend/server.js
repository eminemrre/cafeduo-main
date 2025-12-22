const path = require('path');
const fs = require('fs');

// Try to find .env in multiple locations
const possiblePaths = [
  path.resolve(__dirname, '../.env'), // Root (standard)
  path.resolve(__dirname, '.env'),    // Backend folder
  path.resolve(process.cwd(), '.env') // Current working dir
];

let envPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    envPath = p;
    break;
  }
}

if (envPath) {
  require('dotenv').config({ path: envPath });
  console.log(`✅ Loaded .env from: ${envPath}`);
} else {
  console.warn("⚠️  .env file NOT FOUND in any standard location!");
  console.warn("Checked paths:", possiblePaths);
}


const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { pool } = require('./db');
const jwt = require('jsonwebtoken');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret from .env
const JWT_SECRET = process.env.JWT_SECRET || 'cafeduo_super_secret_key_2024';

console.log("🚀 Starting Server...");
console.log("🔑 Google Client ID:", process.env.VITE_GOOGLE_CLIENT_ID ? "Loaded ✅" : "MISSING ❌");
console.log("🗄️  Database URL:", process.env.DATABASE_URL ? "Loaded ✅" : "MISSING ❌");

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // Attach user info to request
    next();
  });
};

// Helper to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' } // Token valid for 7 days
  );
};

// Security Middleware
app.use(helmet()); // Secure HTTP headers

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin.'
});
app.use(limiter);

// Middleware
const allowedOrigins = [
  'https://cafeduotr.com',
  'https://www.cafeduotr.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://cafeduo-api.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());


// Initialize Database Schema (Robust Version)
const initDb = async () => {
  if (await isDbConnected()) {
    try {
      console.log('🔄 Veritabanı şeması kontrol ediliyor...');

      // 1. Users Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          points INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          games_played INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Cafes Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cafes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Games Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          host_name VARCHAR(255) NOT NULL,
          guest_name VARCHAR(255),
          game_type VARCHAR(50) NOT NULL,
          points INTEGER NOT NULL,
          table_code VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'waiting',
          player1_move VARCHAR(50),
          player2_move VARCHAR(50),
          game_state JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. User Items Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_items (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          item_id INTEGER NOT NULL,
          item_title VARCHAR(255) NOT NULL,
          code VARCHAR(50) NOT NULL,
          redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Rewards Table (Dynamic System)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rewards (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          cost INTEGER NOT NULL,
          description TEXT,
          icon VARCHAR(50),
          cafe_id INTEGER REFERENCES cafes(id),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Add Columns Safely
      const addColumn = async (table, column, type) => {
        try {
          await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${type}`);
        } catch (e) {
          console.error(`⚠️ Sütun eklenemedi: ${table}.${column}`, e.message);
        }
      };

      await addColumn('users', 'department', 'VARCHAR(255)');
      await addColumn('users', 'is_admin', 'BOOLEAN DEFAULT FALSE');
      await addColumn('users', 'role', "VARCHAR(50) DEFAULT 'user'");
      await addColumn('users', 'cafe_id', 'INTEGER REFERENCES cafes(id)');
      await addColumn('users', 'table_number', 'VARCHAR(10)'); // Store table number (e.g. "5" or "MASA05")
      await addColumn('users', 'last_daily_bonus', 'DATE');
      await addColumn('users', 'avatar_url', 'VARCHAR(500)'); // Store Google Profile Picture URL

      await addColumn('user_items', 'is_used', 'BOOLEAN DEFAULT FALSE');
      await addColumn('user_items', 'used_at', 'TIMESTAMP WITH TIME ZONE');

      // Games Table Updates
      await addColumn('games', 'guest_name', 'VARCHAR(255)');
      await addColumn('games', 'player1_move', 'VARCHAR(50)');
      await addColumn('games', 'player2_move', 'VARCHAR(50)');
      await addColumn('games', 'game_state', 'JSONB');

      // Cafes Table Updates (Location System)
      await addColumn('cafes', 'latitude', 'DECIMAL(10, 8)');
      await addColumn('cafes', 'longitude', 'DECIMAL(11, 8)');
      await addColumn('cafes', 'table_count', 'INTEGER DEFAULT 20');
      await addColumn('cafes', 'radius', 'INTEGER DEFAULT 500'); // Meters
      await addColumn('cafes', 'daily_pin', "VARCHAR(6) DEFAULT '0000'"); // Daily PIN code

      // 7. Seed Initial Cafes
      await pool.query(`INSERT INTO cafes (name, table_count, radius, daily_pin) VALUES ('PAÜ İİBF Kantin', 50, 150, '1234'), ('PAÜ Yemekhane', 100, 200, '5678') ON CONFLICT (name) DO NOTHING`);

      // 9. Achievements Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS achievements (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          icon VARCHAR(50) NOT NULL,
          points_reward INTEGER NOT NULL,
          condition_type VARCHAR(50) NOT NULL, -- e.g., 'wins', 'games_played', 'points'
          condition_value INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 10. User Achievements Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          achievement_id INTEGER REFERENCES achievements(id),
          unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, achievement_id)
        );
      `);

      // 11. Seed Initial Achievements
      const achievementsCheck = await pool.query('SELECT COUNT(*) FROM achievements');
      if (parseInt(achievementsCheck.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO achievements (title, description, icon, points_reward, condition_type, condition_value) VALUES
            ('İlk Adım', 'İlk oyununu oyna.', 'footsteps', 50, 'games_played', 1),
            ('Acemi Şanslı', 'İlk galibiyetini al.', 'trophy', 100, 'wins', 1),
            ('Oyun Kurdu', '10 oyun oyna.', 'gamepad', 200, 'games_played', 10),
            ('Yenilmez', '10 galibiyet al.', 'crown', 500, 'wins', 10),
            ('Zengin', '1000 puana ulaş.', 'coins', 300, 'points', 1000)
          `);
        console.log('🏆 Başlangıç başarımları eklendi.');
      }

      // 8. Seed Initial Rewards (If empty)
      const rewardsCheck = await pool.query('SELECT COUNT(*) FROM rewards');
      if (parseInt(rewardsCheck.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO rewards (title, cost, description, icon, is_active) VALUES
            ('Bedava Filtre Kahve', 500, 'Günün yorgunluğunu at.', 'coffee', true),
            ('%20 Hesap İndirimi', 850, 'Tüm masada geçerli.', 'discount', true),
            ('Cheesecake İkramı', 400, 'Tatlı bir mola ver.', 'dessert', true),
            ('Oyun Jetonu x5', 100, 'Ekstra oyun hakkı.', 'game', true)
          `);
        console.log('🎁 Başlangıç ödülleri eklendi.');
      }

      console.log('✅ Veritabanı şeması başarıyla güncellendi.');
    } catch (err) {
      console.error('❌ Kritik Şema Hatası:', err);
    }
  }
};

// --- IN-MEMORY FALLBACK DATA (For testing without DB) ---
let MEMORY_USERS = [
  { id: 1, username: 'DemoUser', email: 'demo@cafe.com', password: '123', points: 1250, wins: 12, gamesPlayed: 25 }
];
let MEMORY_GAMES = [
  { id: 1, hostName: 'GamerTr_99', gameType: 'Taş Kağıt Makas', points: 150, table: 'MASA04', status: 'waiting' }
];
let MEMORY_REWARDS = [];

// Helper to check DB status
const isDbConnected = async () => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (e) {
    return false;
  }
};

// --- CLEANUP JOB ---
// Her 5 dakikada bir çalışır, 30 dakikadan eski 'waiting' oyunları siler
setInterval(async () => {
  console.log('🧹 Running cleanup job for stale games...');
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        "DELETE FROM games WHERE status = 'waiting' AND created_at < $1 RETURNING id",
        [thirtyMinutesAgo]
      );
      if (result.rowCount > 0) {
        console.log(`🗑️ Deleted ${result.rowCount} stale games from DB.`);
      }
    } catch (err) {
      console.error('Cleanup Error:', err);
    }
  } else {
    const initialCount = MEMORY_GAMES.length;
    MEMORY_GAMES = MEMORY_GAMES.filter(g => {
      const createdAt = new Date(g.createdAt || Date.now()); // Fallback if createdAt missing in memory
      return g.status !== 'waiting' || createdAt > new Date(Date.now() - 30 * 60 * 1000);
    });
    const deletedCount = initialCount - MEMORY_GAMES.length;
    if (deletedCount > 0) {
      console.log(`🗑️ Deleted ${deletedCount} stale games from Memory.`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// --- API ROUTES ---

// Email Configuration
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});


// Temporary storage for verification codes
const verificationCodes = new Map();
const pendingUsers = new Map();

// Helper: Verify reCAPTCHA
const verifyRecaptcha = async (token) => {
  // If no token provided, skip verification (for backwards compatibility)
  if (!token) return true;

  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    // If no secret key configured, skip verification
    if (!secretKey) {
      console.warn('RECAPTCHA_SECRET_KEY not configured, skipping verification');
      return true;
    }

    const response = await fetch(`https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`, {
      method: 'POST'
    });
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('reCAPTCHA Error (allowing login):', error);
    // Fail open - allow login if reCAPTCHA service is down
    return true;
  }
};

// 1. REGISTER (Doğrudan Kayıt - E-posta Doğrulaması Kaldırıldı)
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, department } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  // Check if user already exists
  if (await isDbConnected()) {
    const check = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'E-posta kullanımda.' });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, points, department) VALUES ($1, $2, $3, 100, $4) RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin"',
        [username, email, hashedPassword, department || '']
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Register error:', err);
      res.status(400).json({ error: 'Kullanıcı oluşturulamadı.' });
    }
  } else {
    if (MEMORY_USERS.find(u => u.email === email)) return res.status(400).json({ error: 'E-posta kullanımda.' });

    const newUser = {
      id: Date.now(),
      username,
      email,
      password,
      points: 100,
      wins: 0,
      gamesPlayed: 0,
      department
    };
    MEMORY_USERS.push(newUser);
    res.json(newUser);
  }
});

// 1.5 VERIFY (Step 2: Create User)
app.post('/api/auth/verify', async (req, res) => {
  const { email, code } = req.body;

  if (verificationCodes.get(email) !== code) {
    return res.status(400).json({ error: 'Geçersiz doğrulama kodu.' });
  }

  const userData = pendingUsers.get(email);
  if (!userData) {
    return res.status(400).json({ error: 'Oturum zaman aşımına uğradı. Tekrar kayıt olun.' });
  }

  // Create User
  if (await isDbConnected()) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, points, department) VALUES ($1, $2, $3, 100, $4) RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin"',
        [userData.username, userData.email, hashedPassword, userData.department || '']
      );

      // Cleanup
      verificationCodes.delete(email);
      pendingUsers.delete(email);

      res.json(result.rows[0]);
    } catch (err) {
      res.status(400).json({ error: 'Kullanıcı oluşturulamadı.' });
    }
  } else {
    // Fallback
    const newUser = {
      id: Date.now(),
      username: userData.username,
      email: userData.email,
      password: userData.password,
      points: 100,
      wins: 0,
      gamesPlayed: 0,
      department: userData.department
    };
    MEMORY_USERS.push(newUser);

    // Cleanup
    verificationCodes.delete(email);
    pendingUsers.delete(email);

    res.json(newUser);
  }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password, captchaToken } = req.body;

  // Verify reCAPTCHA
  const isHuman = await verifyRecaptcha(captchaToken);
  if (!isHuman) {
    return res.status(400).json({ error: 'Robot doğrulaması başarısız.' });
  }

  if (await isDbConnected()) {
    try {
      const result = await pool.query('SELECT id, username, email, password_hash, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id FROM users WHERE email = $1', [email]);

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
          // Daily Bonus Logic
          let bonusReceived = false;

          // 2. Daily Bonus Check (Only for regular users, not admins)
          const today = new Date().toISOString().split('T')[0];
          const lastBonus = user.last_daily_bonus ? new Date(user.last_daily_bonus).toISOString().split('T')[0] : null;

          // Only give bonus if:
          // 1. User is NOT an admin (is_admin is false)
          // 2. User is NOT a cafe_admin (role is 'user' or null/undefined, but definitely not 'cafe_admin')
          // 3. Has not received bonus today
          const isEligibleForBonus = !user.is_admin && user.role !== 'cafe_admin' && user.role !== 'admin';

          if (isEligibleForBonus && lastBonus !== today) {
            console.log(`🎁 Awarding daily bonus to ${user.username}`);
            await pool.query('UPDATE users SET points = points + 10, last_daily_bonus = NOW() WHERE id = $1', [user.id]);
            user.points += 10;
            bonusReceived = true;
          }

          // FORCE LOCATION RESET: Clear cafe_id on login (ONLY for regular users, NOT cafe admins)
          if (user.role !== 'cafe_admin') {
            await pool.query('UPDATE users SET cafe_id = NULL WHERE id = $1', [user.id]);
            user.cafe_id = null;
          }
          // cafe_admin için cafe_id korunuyor

          // Remove password_hash from response
          delete user.password_hash;
          delete user.last_daily_bonus; // Don't send internal date

          // Generate JWT token
          const token = generateToken(user);

          res.json({ user: { ...user, bonusReceived }, token });
        } else {
          res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
        }
      } else {
        res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err); // Detailed logging
      res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
  } else {
    // Fallback
    const user = MEMORY_USERS.find(u => u.email === email && u.password === password);
    if (user) {
      // Reset cafe_id on login to force re-verification
      if (await isDbConnected()) {
        await pool.query('UPDATE users SET cafe_id = NULL WHERE id = $1', [user.id]);
        user.cafe_id = null;
      }
      res.json(user);
    }
    else res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
  }
});

// 2.1 VERIFY TOKEN (Get current user from JWT)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (await isDbConnected()) {
      const result = await pool.query(
        'SELECT id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    } else {
      const user = MEMORY_USERS.find(u => u.id === userId);
      if (user) {
        res.json(user);
      } else {
        res.status(404).json({ error: 'User not found' });
      }
    }
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2.5 GOOGLE LOGIN
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.VITE_GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { email, name, sub, picture } = payload;

    if (await isDbConnected()) {
      // Check if user exists
      const check = await pool.query('SELECT id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number, avatar_url FROM users WHERE email = $1', [email]);

      if (check.rows.length > 0) {
        // User exists -> Login
        // Update avatar if changed AND clear cafe_id
        if (picture && check.rows[0].avatar_url !== picture) {
          await pool.query('UPDATE users SET avatar_url = $1, cafe_id = NULL WHERE id = $2', [picture, check.rows[0].id]);
          check.rows[0].avatar_url = picture;
        } else {
          // Just clear cafe_id
          await pool.query('UPDATE users SET cafe_id = NULL WHERE id = $1', [check.rows[0].id]);
        }
        check.rows[0].cafe_id = null;

        const user = check.rows[0];
        // Daily Bonus Logic (Same as regular login)
        // ... (Simplified for brevity, ideally refactor bonus logic to a function)
        res.json(user);
      } else {
        // User new -> Register
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        const result = await pool.query(
          'INSERT INTO users (username, email, password_hash, points, department, avatar_url) VALUES ($1, $2, $3, 100, $4, $5) RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, avatar_url',
          [name, email, hashedPassword, 'Google User', picture]
        );
        res.json(result.rows[0]);
      }
    } else {
      // Memory Fallback
      let user = MEMORY_USERS.find(u => u.email === email);
      if (!user) {
        user = {
          id: Date.now(),
          username: name,
          email: email,
          password: 'google-login',
          points: 100,
          wins: 0,
          gamesPlayed: 0,
          department: 'Google User'
        };
        MEMORY_USERS.push(user);
      }
      res.json(user);
    }
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Google doğrulaması başarısız.' });
  }
});

// ===================================
// 3. CAFE ENDPOINTS
// ===================================

// 3.1 GET ALL CAFES
app.get('/api/cafes', async (req, res) => {
  if (await isDbConnected()) {
    try {
      const result = await pool.query('SELECT id, name, address, total_tables, pin FROM cafes ORDER BY name');
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching cafes:', err);
      res.status(500).json({ error: 'Kafeler yüklenemedi.' });
    }
  } else {
    // Fallback cafes
    res.json([
      { id: 1, name: 'PAÜ İİBF Kantin', address: 'İİBF Yerleşkesi', total_tables: 30, pin: '1234' },
      { id: 2, name: 'PAÜ Mühendislik Kafeterya', address: 'Mühendislik Fakültesi', total_tables: 25, pin: '5678' }
    ]);
  }
});

// 3.2 GET SINGLE CAFE
app.get('/api/cafes/:id', async (req, res) => {
  const { id } = req.params;

  if (await isDbConnected()) {
    try {
      const result = await pool.query('SELECT id, name, address, total_tables, pin FROM cafes WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Kafe bulunamadı.' });
      }
    } catch (err) {
      console.error('Error fetching cafe:', err);
      res.status(500).json({ error: 'Kafe yüklenemedi.' });
    }
  } else {
    res.status(404).json({ error: 'Kafe bulunamadı.' });
  }
});

// 3.3 CHECK-IN TO CAFE (CRITICAL)
app.post('/api/cafes/checkin', async (req, res) => {
  const { userId, cafeId, tableNumber, pin } = req.body;

  if (!userId || !cafeId || !tableNumber || !pin) {
    return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
  }

  if (await isDbConnected()) {
    try {
      // 1. Verify cafe PIN
      const cafeResult = await pool.query('SELECT pin FROM cafes WHERE id = $1', [cafeId]);
      if (cafeResult.rows.length === 0) {
        return res.status(404).json({ error: 'Kafe bulunamadı.' });
      }

      const cafe = cafeResult.rows[0];
      if (cafe.pin !== pin) {
        return res.status(401).json({ error: 'Hatalı PIN kodu.' });
      }

      // 2. Update user's cafe_id and table_number
      const userResult = await pool.query(
        `UPDATE users 
         SET cafe_id = $1, table_number = $2 
         WHERE id = $3 
         RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number`,
        [cafeId, tableNumber, userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      const updatedUser = userResult.rows[0];

      // 3. Fetch cafe name
      const cafeNameResult = await pool.query('SELECT name FROM cafes WHERE id = $1', [cafeId]);
      if (cafeNameResult.rows.length > 0) {
        updatedUser.cafe_name = cafeNameResult.rows[0].name;
      }

      res.json(updatedUser);
    } catch (err) {
      console.error('Check-in error:', err);
      res.status(500).json({ error: 'Giriş yapılamadı.' });
    }
  } else {
    // Memory fallback
    const userIdx = MEMORY_USERS.findIndex(u => u.id == userId);
    if (userIdx !== -1) {
      MEMORY_USERS[userIdx].cafe_id = cafeId;
      MEMORY_USERS[userIdx].table_number = tableNumber;
      res.json(MEMORY_USERS[userIdx]);
    } else {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
  }
});

// 3.4 UPDATE CAFE PIN (Admin only)
app.put('/api/cafes/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { pin, userId } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: 'PIN 4 haneli olmalıdır.' });
  }

  if (await isDbConnected()) {
    try {
      // Optional: Verify user is admin
      if (userId) {
        const userCheck = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length === 0 || userCheck.rows[0].role !== 'cafe_admin') {
          return res.status(403).json({ error: 'Yetkisiz işlem.' });
        }
      }

      const result = await pool.query(
        'UPDATE cafes SET pin = $1 WHERE id = $2 RETURNING id, name, pin',
        [pin, id]
      );

      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.status(404).json({ error: 'Kafe bulunamadı.' });
      }
    } catch (err) {
      console.error('PIN update error:', err);
      res.status(500).json({ error: 'PIN güncellenemedi.' });
    }
  } else {
    res.status(501).json({ error: 'Demo modda PIN değiştirilemez.' });
  }
});

// ===================================
// 4. ADMIN ENDPOINTS
// ===================================

// 4.1 GET ALL USERS (Admin only)
app.get('/api/admin/users', async (req, res) => {
  if (await isDbConnected()) {
    try {
      const result = await pool.query(`
        SELECT 
          u.id, u.username, u.email, u.points, u.wins, u.games_played as "gamesPlayed",
          u.department, u.role, u.is_admin as "isAdmin", u.cafe_id, u.table_number,
          c.name as cafe_name
        FROM users u
        LEFT JOIN cafes c ON u.cafe_id = c.id
        ORDER BY u.created_at DESC
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Kullanıcılar yüklenemedi.' });
    }
  } else {
    res.json(MEMORY_USERS);
  }
});

// 4.2 GET ALL GAMES (Admin only)
app.get('/api/admin/games', async (req, res) => {
  if (await isDbConnected()) {
    try {
      const result = await pool.query(`
        SELECT 
          g.id, g.host_name, g.guest_name, g.game_type, g.table_code, g.status,
          g.created_at, c.name as cafe_name
        FROM games g
        LEFT JOIN users u ON g.host_name = u.username
        LEFT JOIN cafes c ON u.cafe_id = c.id
        ORDER BY g.created_at DESC
        LIMIT 100
      `);
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching games:', err);
      res.status(500).json({ error: 'Oyunlar yüklenemedi.' });
    }
  } else {
    res.json([]);
  }
});

// 4.3 UPDATE USER ROLE (Admin only)
app.put('/api/admin/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role, cafe_id } = req.body;

  if (!role || !['user', 'cafe_admin', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol.' });
  }

  // If assigning cafe_admin role, cafe_id is required
  if (role === 'cafe_admin' && !cafe_id) {
    return res.status(400).json({ error: 'Kafe yöneticisi için kafe seçimi zorunludur.' });
  }

  if (await isDbConnected()) {
    try {
      let result;

      if (role === 'cafe_admin') {
        // Assign cafe_admin with cafe_id
        result = await pool.query(
          `UPDATE users SET role = $1, is_admin = $2, cafe_id = $3 WHERE id = $4 RETURNING *`,
          [role, false, cafe_id, id]
        );
      } else {
        // For user or admin role, clear cafe_id
        result = await pool.query(
          `UPDATE users SET role = $1, is_admin = $2, cafe_id = NULL WHERE id = $3 RETURNING *`,
          [role, role === 'admin', id]
        );
      }

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      res.json({ success: true, user: result.rows[0] });
    } catch (err) {
      console.error('Role update error:', err);
      res.status(500).json({ error: 'Rol güncellenemedi.' });
    }
  } else {
    const userIdx = MEMORY_USERS.findIndex(u => u.id == id);
    if (userIdx !== -1) {
      MEMORY_USERS[userIdx].role = role;
      MEMORY_USERS[userIdx].isAdmin = (role === 'admin');
      if (role === 'cafe_admin') {
        MEMORY_USERS[userIdx].cafe_id = cafe_id;
      } else {
        MEMORY_USERS[userIdx].cafe_id = null;
      }
      res.json({ success: true, user: MEMORY_USERS[userIdx] });
    } else {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
  }
});

// 4.4 UPDATE CAFE (Admin only)
app.put('/api/admin/cafes/:id', async (req, res) => {
  const { id } = req.params;
  const { address, total_tables, pin } = req.body;

  if (await isDbConnected()) {
    try {
      const updates = [];
      const values = [];
      let paramCount = 1;

      if (address !== undefined) {
        updates.push(`address = $${paramCount++}`);
        values.push(address);
      }
      if (total_tables !== undefined) {
        updates.push(`total_tables = $${paramCount++}`);
        values.push(total_tables);
      }
      if (pin !== undefined) {
        if (pin.length !== 4) {
          return res.status(400).json({ error: 'PIN 4 haneli olmalıdır.' });
        }
        updates.push(`pin = $${paramCount++}`);
        values.push(pin);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Güncellenecek alan bulunamadı.' });
      }

      values.push(id);
      const query = `UPDATE cafes SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Kafe bulunamadı.' });
      }

      res.json({ success: true, cafe: result.rows[0] });
    } catch (err) {
      console.error('Cafe update error:', err);
      res.status(500).json({ error: 'Kafe güncellenemedi.' });
    }
  } else {
    res.status(501).json({ error: 'Demo modda kafe güncellenemez.' });
  }
});

// 4.5 CREATE CAFE (Admin only)
app.post('/api/admin/cafes', async (req, res) => {
  const { name, address, total_tables, pin } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Kafe adı zorunludur.' });
  }

  const cafePin = pin || '1234';
  const cafeTables = total_tables || 20;

  if (cafePin.length !== 4) {
    return res.status(400).json({ error: 'PIN 4 haneli olmalıdır.' });
  }

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        `INSERT INTO cafes (name, address, total_tables, pin) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [name, address || '', cafeTables, cafePin]
      );

      res.json({ success: true, cafe: result.rows[0] });
    } catch (err) {
      console.error('Cafe creation error:', err);
      if (err.code === '23505') { // Unique violation
        res.status(409).json({ error: 'Bu isimde bir kafe zaten mevcut.' });
      } else {
        res.status(500).json({ error: 'Kafe oluşturulamadı.' });
      }
    }
  } else {
    res.status(501).json({ error: 'Demo modda kafe oluşturulamaz.' });
  }
});

// 2.6 LOCATION CHECK-IN SYSTEM
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// 2.6 LOCATION CHECK-IN SYSTEM (Moved to Section 19)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
// Old endpoint removed to avoid conflict with Section 19

// 3. GET GAMES
app.get('/api/games', async (req, res) => {
  if (await isDbConnected()) {
    const result = await pool.query(`
      SELECT 
        id, 
        host_name as "hostName", 
        game_type as "gameType", 
        points, 
        table_code as "table", 
        status, 
        guest_name as "guestName", 
        created_at as "createdAt" 
      FROM games 
      WHERE status = 'waiting' 
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } else {
    res.json(MEMORY_GAMES);
  }
});

// 4. CREATE GAME
app.post('/api/games', async (req, res) => {
  const { hostName, gameType, points, table } = req.body;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        'INSERT INTO games (host_name, game_type, points, table_code, status) VALUES ($1, $2, $3, $4, \'waiting\') RETURNING id, host_name as "hostName", game_type as "gameType", points, table_code as "table", status, created_at as "createdAt"',
        [hostName, gameType, points, table]
      );
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    const newGame = { id: Date.now(), hostName, gameType, points, table, status: 'waiting' };
    MEMORY_GAMES.unshift(newGame);
    res.json(newGame);
  }
});

// 5. JOIN GAME
app.post('/api/games/:id/join', async (req, res) => {
  const { id } = req.params;
  const { guestName } = req.body;

  if (await isDbConnected()) {
    await pool.query('UPDATE games SET status = \'active\', guest_name = $1 WHERE id = $2', [guestName, id]);
    res.json({ success: true });
  } else {
    const game = MEMORY_GAMES.find(g => g.id == id);
    if (game) {
      game.status = 'active';
      game.guestName = guestName;
    }
    res.json({ success: true });
  }
});

// 6. GET GAME STATE (Polling)
app.get('/api/games/:id', async (req, res) => {
  const { id } = req.params;
  if (await isDbConnected()) {
    const result = await pool.query(`
      SELECT 
        id, 
        host_name as "hostName", 
        game_type as "gameType", 
        points, 
        table_code as "table", 
        status, 
        guest_name as "guestName", 
        player1_move as "player1Move", 
        player2_move as "player2Move", 
        game_state as "gameState", 
        created_at as "createdAt" 
      FROM games 
      WHERE id = $1
    `, [id]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  } else {
    const game = MEMORY_GAMES.find(g => g.id == id);
    res.json(game || {});
  }
});

// 7. MAKE MOVE
app.post('/api/games/:id/move', async (req, res) => {
  const { id } = req.params;
  const { player, move, gameState } = req.body; // player: 'host' or 'guest'

  if (await isDbConnected()) {
    let query = '';
    let params = [];
    if (player === 'host') {
      query = 'UPDATE games SET player1_move = $1 WHERE id = $2';
      params = [move, id];
    } else {
      query = 'UPDATE games SET player2_move = $1 WHERE id = $2';
      params = [move, id];
    }

    if (gameState) {
      query = 'UPDATE games SET game_state = $1 WHERE id = $2';
      params = [gameState, id];
    }

    await pool.query(query, params);
    res.json({ success: true });
  } else {
    // Memory fallback
    res.json({ success: true });
  }
});



// 8. FINISH GAME
app.post('/api/games/:id/finish', async (req, res) => {
  const { id } = req.params;
  const { winner } = req.body;

  if (await isDbConnected()) {
    await pool.query('UPDATE games SET status = \'finished\', winner = $1 WHERE id = $2', [winner, id]);
    res.json({ success: true });
  } else {
    const game = MEMORY_GAMES.find(g => g.id == id);
    if (game) {
      game.status = 'finished';
      game.winner = winner;
    }
    res.json({ success: true });
  }
});

// 9. DELETE GAME
app.delete('/api/games/:id', async (req, res) => {
  const { id } = req.params;
  if (await isDbConnected()) {
    await pool.query('DELETE FROM games WHERE id = $1', [id]);
    res.json({ success: true });
  } else {
    MEMORY_GAMES = MEMORY_GAMES.filter(g => g.id != id);
    res.json({ success: true });
  }
});



// 7. SHOP: BUY ITEM
app.post('/api/shop/buy', async (req, res) => {
  const { userId, item } = req.body; // item: { id, title, cost, icon }

  if (await isDbConnected()) {
    try {
      // 1. Check points
      const userRes = await pool.query('SELECT points FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const currentPoints = userRes.rows[0].points;
      if (currentPoints < item.cost) {
        return res.status(400).json({ error: 'Yetersiz puan.' });
      }

      // 2. Deduct points
      const newPoints = currentPoints - item.cost;
      await pool.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);

      // 3. Add to inventory
      const crypto = require('crypto');
      const code = `CD-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const redeemRes = await pool.query(
        'INSERT INTO user_items (user_id, item_id, item_title, code) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, item.id, item.title, code]
      );

      res.json({ success: true, newPoints, reward: redeemRes.rows[0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'İşlem başarısız.' });
    }
  } else {
    res.status(500).json({ error: 'Veritabanı bağlantısı yok.' });
  }
});

// Get User Items (Coupons)
app.get('/api/users/:id/items', async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query(
        `SELECT id, user_id, item_id, item_title, code, redeemed_at, is_used, used_at FROM user_items 
         WHERE user_id = $1 
         AND redeemed_at > NOW() - INTERVAL '5 days'
         ORDER BY redeemed_at DESC`,
        [userId]
      );
      res.json(result.rows.map(item => ({
        ...item,
        status: item.is_used ? 'used' : 'active'
      })));
    } else {
      // Memory fallback
      const items = memoryItems.filter(item => {
        const isExpired = new Date(item.redeemed_at) < new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        return item.user_id === userId && !isExpired;
      });
      res.json(items.map(item => ({
        ...item,
        status: item.is_used ? 'used' : 'active'
      })));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Use Coupon (Cafe Admin)
app.post('/api/coupons/use', async (req, res) => {
  const { code } = req.body;
  try {
    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query(
        `UPDATE user_items 
         SET is_used = TRUE, used_at = NOW() 
         WHERE code = $1 AND is_used = FALSE AND redeemed_at > NOW() - INTERVAL '5 days'
         RETURNING *`,
        [code]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Kupon geçersiz, süresi dolmuş veya zaten kullanılmış.' });
      }

      res.json({ success: true, item: result.rows[0] });
    } else {
      const itemIndex = memoryItems.findIndex(i => i.code === code && !i.is_used && new Date(i.redeemed_at) > new Date(Date.now() - 5 * 24 * 60 * 60 * 1000));
      if (itemIndex === -1) {
        return res.status(400).json({ error: 'Kupon bulunamadı, süresi dolmuş veya zaten kullanılmış.' });
      }
      memoryItems[itemIndex].is_used = true;
      memoryItems[itemIndex].used_at = new Date();
      res.json({ success: true, item: memoryItems[itemIndex] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Cafes
app.get('/api/cafes', async (req, res) => {
  try {
    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query('SELECT * FROM cafes ORDER BY name');
      res.json(result.rows);
    } else {
      res.json([
        { id: 1, name: 'PAÜ İİBF Kantin' },
        { id: 2, name: 'PAÜ Yemekhane' }
      ]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Create Cafe Admin (Super Admin only)
app.post('/api/admin/cafe-admins', async (req, res) => {
  const { username, email, password, cafeId } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (await isDbConnected()) { // Check DB connection
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, role, cafe_id) 
         VALUES ($1, $2, $3, 'cafe_admin', $4) 
         RETURNING id, username, email, role, cafe_id`,
        [username, email, hashedPassword, cafeId]
      );
      res.json(result.rows[0]);
    } else {
      res.status(501).json({ error: 'Not implemented in memory mode' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 8. SHOP: GET INVENTORY
app.get('/api/shop/inventory/:userId', async (req, res) => {
  const { userId } = req.params;
  if (await isDbConnected()) {
    // Filter expired coupons (5 days)
    const result = await pool.query("SELECT * FROM user_items WHERE user_id = $1 AND redeemed_at > NOW() - INTERVAL '5 days' ORDER BY redeemed_at DESC", [userId]);
    // Map to frontend format
    const rewards = result.rows.map(row => ({
      redeemId: row.id,
      id: row.item_id,
      title: row.item_title,
      code: row.code,
      redeemedAt: row.redeemed_at
    }));
    res.json(rewards);
  } else {
    // Memory Fallback with Expiration
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    // In a real app we might delete them, here we just filter for display
    const userItems = MEMORY_REWARDS.filter(r => r.userId == userId && new Date(r.redeemedAt) > fiveDaysAgo);
    res.json(userItems);
  }
});

// 9. ADMIN: GET USERS
app.get('/api/admin/users', async (req, res) => {
  if (await isDbConnected()) {
    const result = await pool.query('SELECT id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, (SELECT name FROM cafes WHERE id = users.cafe_id) as cafe_name FROM users ORDER BY id ASC');
    res.json(result.rows);
  } else {
    res.json(MEMORY_USERS);
  }
});

// 18. ADMIN: GET ALL GAMES
app.get('/api/admin/games', async (req, res) => {
  if (await isDbConnected()) {
    const result = await pool.query(`
      SELECT 
        g.id, 
        g.host_name, 
        g.guest_name, 
        g.game_type, 
        g.points, 
        g.table_code, 
        g.status, 
        g.created_at,
        c.name as cafe_name
      FROM games g
      LEFT JOIN users u ON u.username = g.host_name
      LEFT JOIN cafes c ON c.id = u.cafe_id
      ORDER BY g.created_at DESC
    `);
    res.json(result.rows);
  } else {
    res.json(MEMORY_GAMES);
  }
});

// 19. ADMIN: UPDATE CAFE
app.put('/api/admin/cafes/:id', async (req, res) => {
  const { id } = req.params;
  const { latitude, longitude, table_count, radius } = req.body;

  if (await isDbConnected()) {
    try {
      await pool.query(
        'UPDATE cafes SET latitude = $1, longitude = $2, table_count = $3, radius = $4 WHERE id = $5',
        [latitude, longitude, table_count, radius, id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kafe güncellenemedi.' });
    }
  } else {
    res.json({ success: true });
  }
});

// 19. CHECK-IN (PIN Verification - STRICT MODE)
app.post('/api/cafes/check-in', async (req, res) => {
  const { userId, cafeId, tableNumber, pin } = req.body;

  // Validate input
  if (!userId || !cafeId || !tableNumber) {
    return res.status(400).json({ error: 'Eksik bilgi: userId, cafeId, tableNumber gerekli.' });
  }

  if (!pin || pin.length < 4) {
    return res.status(400).json({ error: 'PIN kodu gerekli (en az 4 haneli).' });
  }

  if (await isDbConnected()) {
    try {
      // 1. Get Cafe
      const cafeRes = await pool.query('SELECT * FROM cafes WHERE id = $1', [cafeId]);
      if (cafeRes.rows.length === 0) return res.status(404).json({ error: 'Kafe bulunamadı.' });
      const cafe = cafeRes.rows[0];

      // 2. Verify PIN (STRICT: PIN must match)
      const cafePin = cafe.daily_pin || '0000'; // Default PIN if not set

      // DEBUG MODE: Show expected PIN (remove in production!)
      const isDemoMode = process.env.NODE_ENV !== 'production';

      if (cafePin !== pin) {
        console.log(`PIN mismatch for cafe ${cafe.name}: expected "${cafePin}", got "${pin}"`);

        if (isDemoMode) {
          return res.status(400).json({
            error: `Yanlış PIN! Doğru PIN: ${cafePin} (Demo Modu)`
          });
        }

        return res.status(400).json({ error: 'Yanlış PIN kodu! Kafe personelinden güncel PIN kodunu isteyin.' });
      }

      // 3. Update User (Check-in)
      const formattedTable = `MASA${tableNumber.toString().padStart(2, '0')}`;
      await pool.query('UPDATE users SET cafe_id = $1, table_number = $2 WHERE id = $3', [cafeId, formattedTable, userId]);

      res.json({ success: true, cafeName: cafe.name, table: formattedTable });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Check-in işlemi başarısız.' });
    }
  } else {
    // Memory Fallback - ALSO REQUIRES PIN CHECK
    // For demo mode, default PIN is 0000
    const demoPins = { 1: '1234', 2: '5678' };
    const expectedPin = demoPins[cafeId] || '0000';

    if (expectedPin !== pin) {
      return res.status(400).json({ error: 'Yanlış PIN kodu! Demo için PIN: 0000, 1234 veya 5678' });
    }

    const user = MEMORY_USERS.find(u => u.id === userId);
    if (user) {
      user.cafe_id = cafeId;
      user.table_number = `MASA${tableNumber.toString().padStart(2, '0')}`;
    }
    res.json({ success: true, cafeName: 'Demo Cafe', table: `MASA${tableNumber.toString().padStart(2, '0')}` });
  }
});

// 19.5 UPDATE CAFE PIN (For Cafe Admins) - YENİ VERSİYON
// userId ile çalışır, cafe_id'yi veritabanından alır
app.put('/api/cafes/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { pin, userId } = req.body;

  console.log(`[PIN UPDATE] Request: cafeId=${id}, pin=${pin}, userId=${userId}`);

  if (!pin || pin.length < 4 || pin.length > 6) {
    return res.status(400).json({ error: 'PIN 4-6 karakter olmalı.' });
  }

  if (await isDbConnected()) {
    try {
      let targetCafeId = id;

      // Eğer cafeId "null" veya "undefined" string olarak geldiyse, userId'den bul
      if (!id || id === 'null' || id === 'undefined') {
        if (!userId) {
          return res.status(400).json({ error: 'userId gerekli.' });
        }

        // Kullanıcının cafe_id'sini veritabanından al
        const userRes = await pool.query('SELECT cafe_id FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0 || !userRes.rows[0].cafe_id) {
          return res.status(400).json({ error: 'Bu kullanıcı bir kafeye bağlı değil.' });
        }
        targetCafeId = userRes.rows[0].cafe_id;
        console.log(`[PIN UPDATE] Found cafe_id from user: ${targetCafeId}`);
      }

      // PIN'i güncelle
      const result = await pool.query('UPDATE cafes SET daily_pin = $1 WHERE id = $2', [pin, targetCafeId]);
      console.log(`[PIN UPDATE] Updated ${result.rowCount} rows for cafe ${targetCafeId}`);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Kafe bulunamadı.' });
      }

      res.json({ success: true, pin, cafeId: targetCafeId });
    } catch (err) {
      console.error('[PIN UPDATE] Error:', err);
      res.status(500).json({ error: 'PIN güncellenemedi: ' + err.message });
    }
  } else {
    res.json({ success: true, pin });
  }
});

// 20. ADMIN: CREATE CAFE
app.post('/api/admin/cafes', async (req, res) => {
  const { name, latitude, longitude, table_count, radius } = req.body;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        'INSERT INTO cafes (name, latitude, longitude, table_count, radius) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, latitude, longitude, table_count, radius]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Kafe oluşturulamadı. İsim benzersiz olmalı.' });
    }
  } else {
    const newCafe = { id: Date.now(), name, latitude, longitude, table_count, radius };
    res.json(newCafe);
  }
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// ... (keep existing API routes)

// 10. ADMIN: DELETE USER
app.delete('/api/admin/users/:id', async (req, res) => {
  const { id } = req.params;
  if (await isDbConnected()) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } else {
    MEMORY_USERS = MEMORY_USERS.filter(u => u.id != id);
    res.json({ success: true });
  }
});

// 11. REWARDS: GET ALL
app.get('/api/rewards', async (req, res) => {
  if (await isDbConnected()) {
    try {
      const result = await pool.query('SELECT * FROM rewards WHERE is_active = true ORDER BY cost ASC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Ödüller yüklenemedi.' });
    }
  } else {
    // Memory fallback
    res.json([
      { id: 1, title: 'Bedava Filtre Kahve', cost: 500, description: 'Günün yorgunluğunu at.', icon: 'coffee' },
      { id: 2, title: '%20 Hesap İndirimi', cost: 850, description: 'Tüm masada geçerli.', icon: 'discount' },
      { id: 3, title: 'Cheesecake İkramı', cost: 400, description: 'Tatlı bir mola ver.', icon: 'dessert' },
    ]);
  }
});

// 14. REWARDS: DELETE
app.delete('/api/rewards/:id', async (req, res) => {
  const { id } = req.params;
  if (await isDbConnected()) {
    try {
      await pool.query('UPDATE rewards SET is_active = false WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Silme işlemi başarısız.' });
    }
  } else {
    res.status(501).json({ error: 'Not implemented in memory mode' });
  }
});

// 15. LEADERBOARD
app.get('/api/leaderboard', async (req, res) => {
  const { type, department } = req.query; // type: 'general' or 'department'

  if (await isDbConnected()) {
    try {
      let query = 'SELECT id, username, points, wins, games_played as "gamesPlayed", department FROM users';
      let params = [];

      if (type === 'department' && department) {
        query += ' WHERE department = $1';
        params.push(department);
      }

      query += ' ORDER BY points DESC LIMIT 50';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Liderlik tablosu yüklenemedi.' });
    }
  } else {
    // Memory fallback
    let users = [...MEMORY_USERS];
    if (type === 'department' && department) {
      users = users.filter(u => u.department === department);
    }
    users.sort((a, b) => b.points - a.points);
    res.json(users.slice(0, 50));
  }
});

// 16. ACHIEVEMENTS: GET ALL & USER STATUS
app.get('/api/achievements/:userId', async (req, res) => {
  const { userId } = req.params;

  if (await isDbConnected()) {
    try {
      // Get all achievements
      const allAchievements = await pool.query('SELECT * FROM achievements ORDER BY points_reward ASC');

      // Get user's unlocked achievements
      const userUnlocked = await pool.query('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = $1', [userId]);
      const unlockedMap = new Map();
      userUnlocked.rows.forEach(row => unlockedMap.set(row.achievement_id, row.unlocked_at));

      const result = allAchievements.rows.map(ach => ({
        ...ach,
        unlocked: unlockedMap.has(ach.id),
        unlockedAt: unlockedMap.get(ach.id) || null
      }));

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Başarımlar yüklenemedi.' });
    }
  } else {
    res.json([]); // Fallback
  }
});

// 16. CHECK ACHIEVEMENTS (Call this after game/point updates)
const checkAchievements = async (userId) => {
  if (!await isDbConnected()) return;

  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) return;
    const user = userRes.rows[0];

    const achievementsRes = await pool.query('SELECT * FROM achievements');
    const achievements = achievementsRes.rows;

    for (const ach of achievements) {
      let qualified = false;
      if (ach.condition_type === 'points' && user.points >= ach.condition_value) qualified = true;
      if (ach.condition_type === 'wins' && user.wins >= ach.condition_value) qualified = true;
      if (ach.condition_type === 'games_played' && user.games_played >= ach.condition_value) qualified = true;

      if (qualified) {
        // Try to insert (ignore if already exists due to UNIQUE constraint)
        const insertRes = await pool.query(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *',
          [userId, ach.id]
        );

        if (insertRes.rows.length > 0) {
          // Newly unlocked! Give reward
          await pool.query('UPDATE users SET points = points + $1 WHERE id = $2', [ach.points_reward, userId]);
          console.log(`🏆 Achievement Unlocked: ${user.username} - ${ach.title} (+${ach.points_reward} pts)`);
        }
      }
    }
  } catch (err) {
    console.error('Achievement Check Error:', err);
  }
};

// 17. GET ACTIVE GAME FOR USER
app.get('/api/users/:username/active-game', async (req, res) => {
  const { username } = req.params;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(`
        SELECT 
          id, 
          host_name as "hostName", 
          game_type as "gameType", 
          points, 
          table_code as "table", 
          status, 
          guest_name as "guestName", 
          player1_move as "player1Move", 
          player2_move as "player2Move", 
          game_state as "gameState", 
          created_at as "createdAt" 
        FROM games 
        WHERE (host_name = $1 OR guest_name = $1) AND status = 'active' 
        LIMIT 1
      `, [username]);

      if (result.rows.length > 0) {
        res.json(result.rows[0]);
      } else {
        res.json(null);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Aktif oyun sorgulanamadı.' });
    }
  } else {
    const game = MEMORY_GAMES.find(g =>
      (g.hostName === username || g.guestName === username) && g.status === 'active'
    );
    res.json(game || null);
  }
});

// Hook into User Update to check achievements
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { points, wins, gamesPlayed } = req.body;

  if (await isDbConnected()) {
    const result = await pool.query(
      'UPDATE users SET points = $1, wins = $2, games_played = $3, department = $4 WHERE id = $5 RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number, avatar_url',
      [points, wins, gamesPlayed, req.body.department, id]
    );

    const user = result.rows[0];

    // Fetch cafe name if cafe_id exists
    if (user.cafe_id) {
      const cafeRes = await pool.query('SELECT name FROM cafes WHERE id = $1', [user.cafe_id]);
      if (cafeRes.rows.length > 0) {
        user.cafe_name = cafeRes.rows[0].name;
      }
    }

    res.json(user);

    // Check achievements asynchronously
    checkAchievements(id);

    res.json(result.rows[0]);
  } else {
    const idx = MEMORY_USERS.findIndex(u => u.id == id);
    if (idx !== -1) {
      MEMORY_USERS[idx] = { ...MEMORY_USERS[idx], points, wins, gamesPlayed };
      res.json(MEMORY_USERS[idx]);
    } else {
      res.status(404).json({ error: 'User not found' });
    }
  }
});

// --- DÜZELTİLEN KISIM BAŞLANGICI ---

// Eskiden burada dist/index.html çağıran kod vardı, onu kaldırdık.
// Şimdi Render'a girenler hata almasın diye basit bir mesaj gösteriyoruz:
app.get('/', (req, res) => {
  res.send('✅ CafeDuo API Sunucusu (Render) Aktif!');
});

// --- DÜZELTİLEN KISIM BİTİŞİ ---

// 21. AUTO-CLEANUP STUCK GAMES
setInterval(async () => {
  if (await isDbConnected()) {
    try {
      // Mark games as 'finished' if created more than 2 hours ago and still 'waiting' or 'active'
      await pool.query(`
        UPDATE games 
        SET status = 'finished' 
        WHERE status IN ('waiting', 'active') 
        AND created_at < NOW() - INTERVAL '2 hours'
      `);
    } catch (err) {
      console.error("Auto-cleanup failed:", err);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

// 22. ADMIN: UPDATE USER ROLE
app.put('/api/admin/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; // 'cafe_admin' or 'user'

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
        [role, id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Rol güncellenemedi.' });
    }
  } else {
    res.status(501).json({ error: 'Not implemented in memory mode' });
  }
});

// 23. SHOP: BUY REWARD
app.post('/api/shop/buy', async (req, res) => {
  const { userId, rewardId } = req.body;

  if (!userId || !rewardId) {
    return res.status(400).json({ error: 'userId ve rewardId gerekli.' });
  }

  if (await isDbConnected()) {
    try {
      // 1. Get User
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      const user = userRes.rows[0];

      // 2. Get Reward
      const rewardRes = await pool.query('SELECT * FROM rewards WHERE id = $1', [rewardId]);
      if (rewardRes.rows.length === 0) return res.status(404).json({ error: 'Ödül bulunamadı.' });
      const reward = rewardRes.rows[0];

      // 3. Check Points
      if (user.points < reward.cost) {
        return res.status(400).json({ error: `Yetersiz puan! ${reward.cost} puan gerekli, ${user.points} puanınız var.` });
      }

      // 4. Deduct Points
      await pool.query('UPDATE users SET points = points - $1 WHERE id = $2', [reward.cost, userId]);

      // 5. Generate Coupon Code
      const couponCode = `CD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // 6. Add to User Items
      await pool.query(
        'INSERT INTO user_items (user_id, item_id, item_title, code) VALUES ($1, $2, $3, $4)',
        [userId, rewardId, reward.title, couponCode]
      );

      res.json({
        success: true,
        message: `${reward.title} satın alındı!`,
        code: couponCode,
        newPoints: user.points - reward.cost
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Satın alma işlemi başarısız.' });
    }
  } else {
    res.status(501).json({ error: 'Shop not available in demo mode.' });
  }
});

// 24. SHOP: GET USER INVENTORY
app.get('/api/shop/inventory/:userId', async (req, res) => {
  const { userId } = req.params;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        `SELECT ui.id as redeemId, ui.item_title as title, ui.code, ui.is_used as isUsed, 
         ui.redeemed_at as redeemedAt, ui.used_at as usedAt,
         r.cost, r.description, r.icon
         FROM user_items ui
         LEFT JOIN rewards r ON ui.item_id = r.id
         WHERE ui.user_id = $1
         ORDER BY ui.redeemed_at DESC`,
        [userId]
      );
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Envanter yüklenemedi.' });
    }
  } else {
    res.json([]); // Empty inventory in demo mode
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
});

// Prevent Node.js from crashing on unhandled errors
process.on('uncaughtException', (err) => {
  console.error('CRITICAL ERROR (Uncaught Exception):', err);
  // Do not exit, keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
});

// Initialize DB and start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
});