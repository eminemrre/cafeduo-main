const path = require('path');
const fs = require('fs');

/**
 * Load environment variables from .env file
 * Searches in multiple locations for flexibility
 */
function loadEnvFile() {
  const possiblePaths = [
    path.resolve(__dirname, '../.env'), // Root (standard)
    path.resolve(__dirname, '.env'),    // Backend folder
    path.resolve(process.cwd(), '.env') // Current working dir
  ];

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      console.log(`✅ Loaded .env from: ${envPath}`);
      return;
    }
  }

  console.warn("⚠️  .env file NOT FOUND in any standard location!");
  console.warn("Checked paths:", possiblePaths);
}

loadEnvFile();


// Core dependencies
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Server } = require("socket.io");

// Local modules
const { pool } = require('./db');
const { cache, clearCache } = require('./middleware/cache'); // Redis Cache Import
const authRoutes = require('./routes/authRoutes');
const cafeRoutes = require('./routes/cafeRoutes'); // Cafe Routes Import
const { authenticateToken, requireAdmin, requireOwnership, requireCafeAdmin } = require('./middleware/auth'); // Auth Middleware Imports

// Simple Logger (can be replaced with Winston in production)
const logger = {
  info: (...args) => console.log(new Date().toISOString(), '[INFO]', ...args),
  error: (...args) => console.error(new Date().toISOString(), '[ERROR]', ...args),
  warn: (...args) => console.warn(new Date().toISOString(), '[WARN]', ...args),
  debug: (...args) => process.env.NODE_ENV === 'development' && console.log(new Date().toISOString(), '[DEBUG]', ...args)
};

const DEFAULT_ALLOWED_ORIGINS = [
  'https://cafeduotr.com',
  'https://www.cafeduotr.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://cafeduo-api.onrender.com'
];

const parseAllowedOrigins = (originsValue) => {
  if (!originsValue) return DEFAULT_ALLOWED_ORIGINS;
  const parsed = originsValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
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

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);

const app = express();
const server = http.createServer(app); // Wrap Express
const PORT = process.env.PORT || 3001;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

if (process.env.TRUST_PROXY) {
  const trustProxyEnv = process.env.TRUST_PROXY.trim();
  const parsedTrustProxy = Number.isNaN(Number(trustProxyEnv))
    ? (trustProxyEnv === 'true' ? true : trustProxyEnv)
    : Number(trustProxyEnv);
  app.set('trust proxy', parsedTrustProxy);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

logger.info('Allowed CORS origins:', allowedOrigins);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Socket.IO Logic
const rpsGames = new Map(); // Store active RPS games in memory: { gameId: { p1: { id, move, score }, p2: { ... }, round: 1 } }

io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // General Join
  socket.on('join_game', (gameId) => {
    socket.join(gameId);
    console.log(`Socket ${socket.id} joined game: ${gameId}`);
  });

  // --- Rock Paper Scissors Logic ---
  socket.on('rps_join', ({ gameId, username }) => {
    socket.join(gameId);

    if (!rpsGames.has(gameId)) {
      rpsGames.set(gameId, {
        players: {},
        rounds: 0,
        history: []
      });
    }

    const game = rpsGames.get(gameId);

    // Add player if not exists
    if (!game.players[socket.id]) {
      // Limit to 2 players
      if (Object.keys(game.players).length < 2) {
        game.players[socket.id] = { id: socket.id, username, move: null, score: 0 };
        console.log(`Player ${username} (${socket.id}) joined RPS game ${gameId}`);
      } else {
        socket.emit('error', 'Game full');
        return;
      }
    }

    // Notify everyone in room about updated player list
    io.to(gameId).emit('rps_update_players', Object.values(game.players));
  });

  socket.on('rps_move', ({ gameId, move }) => {
    const game = rpsGames.get(gameId);
    if (!game || !game.players[socket.id]) return;

    game.players[socket.id].move = move;
    console.log(`Player ${socket.id} moved in ${gameId}`);

    // Notify opponent that a move was made (but not WHAT move)
    socket.to(gameId).emit('rps_opponent_moved');

    // Check if both players moved
    const playerIds = Object.keys(game.players);
    if (playerIds.length === 2) {
      const p1 = game.players[playerIds[0]];
      const p2 = game.players[playerIds[1]];

      if (p1.move && p2.move) {
        // Calculate Winner
        let winner = 'draw';
        if (p1.move !== p2.move) {
          if (
            (p1.move === 'rock' && p2.move === 'scissors') ||
            (p1.move === 'scissors' && p2.move === 'paper') ||
            (p1.move === 'paper' && p2.move === 'rock')
          ) {
            winner = p1.id;
            p1.score += 1;
          } else {
            winner = p2.id;
            p2.score += 1;
          }
        }

        const result = {
          p1: { id: p1.id, move: p1.move, score: p1.score },
          p2: { id: p2.id, move: p2.move, score: p2.score },
          winner
        };

        // Reset moves for next round
        p1.move = null;
        p2.move = null;
        game.rounds += 1;

        // Emit result to specific game room after delay
        setTimeout(() => {
          io.to(gameId).emit('rps_round_result', result);
        }, 500); // 500ms delay for suspense
      }
    }
  });

  socket.on('game_move', (data) => {
    // data: { gameId, move, player }
    console.log(`Move received in game ${data.gameId}:`, data);
    socket.to(data.gameId).emit('opponent_move', data);
  });

  // Game state sync
  socket.on('update_game_state', (data) => {
    // data: { gameId, state }
    socket.to(data.gameId).emit('game_state_updated', data.state);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Optional: Handle cleanup if needed, or leave for room auto-cleanup
    // For robust app, we should remove player from rpsGames
    for (const [gameId, game] of rpsGames.entries()) {
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        io.to(gameId).emit('rps_player_disconnected', socket.id);
        if (Object.keys(game.players).length === 0) {
          rpsGames.delete(gameId);
        }
        break;
      }
    }
  });
});

// JWT Secret from .env (required)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

console.log("🚀 Starting Server...");
console.log("🔑 Google Client ID:", process.env.VITE_GOOGLE_CLIENT_ID ? "Loaded ✅" : "MISSING ❌");
console.log("🗄️  Database URL:", process.env.DATABASE_URL ? "Loaded ✅" : "MISSING ❌");

// ==========================================
// SECURITY MIDDLEWARE - Enhanced Authentication
// ==========================================

/**
 * Enhanced JWT Authentication Middleware
 * Verifies token and fetches fresh user data from DB
 */
// Middleware (Moved to backend/middleware/auth.js)
// authenticateToken, requireAdmin, requireCafeAdmin, requireOwnership


// Security Middleware
app.use(helmet()); // Secure HTTP headers

// Rate Limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin.'
});
app.use(limiter);

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
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
const memoryItems = []; // Code Review Fix: Define undefined variable
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

const promoteBootstrapAdmins = async () => {
  if (BOOTSTRAP_ADMIN_EMAILS.length === 0) return;

  if (!(await isDbConnected())) {
    logger.warn('Skipping bootstrap admin sync: database is not connected.');
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET role = 'admin',
           is_admin = true,
           cafe_id = NULL
       WHERE LOWER(email) = ANY($1::text[])
         AND (role <> 'admin' OR is_admin = false)`,
      [BOOTSTRAP_ADMIN_EMAILS]
    );

    logger.info('Bootstrap admin sync completed.', {
      targetEmails: BOOTSTRAP_ADMIN_EMAILS,
      affectedRows: result.rowCount
    });
  } catch (error) {
    logger.error('Bootstrap admin sync failed.', error);
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
// --- API ROUTES ---

// Auth Routes (Modularized)
app.use('/api/auth', authRoutes);

// Cafe Routes (Modularized)
app.use('/api/cafes', cafeRoutes);


// 1. REGISTER (Moved to authController)


// 1.5 VERIFY (Step 2: Create User)
// 1.5 VERIFY (Moved to authController)

// 2. LOGIN
// 2. LOGIN (Moved to authController)

// 2.1 VERIFY TOKEN (Get current user from JWT)
// 2.1 VERIFY TOKEN (Moved to authController)

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

// 3. CAFE ENDPOINTS (Moved to cafeController)

// 3.3 CHECK-IN (Moved to cafeController)

// 3.4 UPDATE PIN (Moved to cafeController)

// ===================================
// 4. ADMIN ENDPOINTS
// ===================================

// 4.1 GET ALL USERS (Admin only) - PROTECTED
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
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

// 4.2 CREATE USER (Admin only) - PROTECTED
app.post('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { username, email, password, department, role, cafe_id, points } = req.body || {};

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı, e-posta ve şifre zorunludur.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const nextRole = ['user', 'admin', 'cafe_admin'].includes(role) ? role : 'user';
  const nextPoints = Number.isFinite(Number(points)) ? Math.max(0, Math.floor(Number(points))) : 100;
  const nextCafeId = nextRole === 'cafe_admin' ? Number(cafe_id) : null;

  if (nextRole === 'cafe_admin' && !nextCafeId) {
    return res.status(400).json({ error: 'Kafe yöneticisi için kafe seçimi zorunludur.' });
  }

  if (await isDbConnected()) {
    try {
      const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [normalizedEmail]);
      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı.' });
      }

      const hashedPassword = await bcrypt.hash(String(password), 10);
      const result = await pool.query(
        `INSERT INTO users (
          username, email, password_hash, points, wins, games_played, department, role, is_admin, cafe_id
        ) VALUES ($1, $2, $3, $4, 0, 0, $5, $6, $7, $8)
        RETURNING
          id, username, email, points, wins, games_played as "gamesPlayed",
          department, role, is_admin as "isAdmin", cafe_id`,
        [
          String(username).trim(),
          normalizedEmail,
          hashedPassword,
          nextPoints,
          department || '',
          nextRole,
          nextRole === 'admin',
          nextRole === 'cafe_admin' ? nextCafeId : null
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Admin create user error:', err);
      return res.status(500).json({ error: 'Kullanıcı oluşturulamadı.' });
    }
  }

  const nextId = (MEMORY_USERS.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) || 0) + 1;
  const createdUser = {
    id: nextId,
    username: String(username).trim(),
    email: normalizedEmail,
    points: nextPoints,
    wins: 0,
    gamesPlayed: 0,
    department: department || '',
    role: nextRole,
    isAdmin: nextRole === 'admin',
    cafe_id: nextRole === 'cafe_admin' ? nextCafeId : null
  };
  MEMORY_USERS.unshift(createdUser);
  return res.status(201).json(createdUser);
});

// 4.3 GET ALL GAMES (Admin only) - PROTECTED
app.get('/api/admin/games', authenticateToken, requireAdmin, async (req, res) => {
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

// 4.4 UPDATE USER ROLE (Admin only) - PROTECTED
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, async (req, res) => {
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

// 4.5 UPDATE USER POINTS (Admin only) - PROTECTED
app.patch('/api/admin/users/:id/points', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const points = Math.floor(Number(req.body?.points));

  if (!Number.isFinite(points) || points < 0) {
    return res.status(400).json({ error: 'Puan 0 veya daha büyük bir sayı olmalıdır.' });
  }

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        `UPDATE users
         SET points = $1
         WHERE id = $2
         RETURNING
           id, username, email, points, wins, games_played as "gamesPlayed",
           department, role, is_admin as "isAdmin", cafe_id`,
        [points, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      }

      return res.json(result.rows[0]);
    } catch (err) {
      console.error('Admin update points error:', err);
      return res.status(500).json({ error: 'Puan güncellenemedi.' });
    }
  }

  const userIndex = MEMORY_USERS.findIndex((user) => Number(user.id) === Number(id));
  if (userIndex === -1) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  }
  MEMORY_USERS[userIndex] = { ...MEMORY_USERS[userIndex], points };
  return res.json(MEMORY_USERS[userIndex]);
});

// 4.6 UPDATE CAFE (Admin only) - PROTECTED
app.put('/api/admin/cafes/:id', authenticateToken, requireAdmin, async (req, res) => {
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

// 4.7 CREATE CAFE (Admin only) - PROTECTED
app.post('/api/admin/cafes', authenticateToken, requireAdmin, async (req, res) => {
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

// ===================================
// 5. REWARDS ENDPOINTS (for Cafe Admins)
// ===================================

// 5.1 CREATE REWARD (Cafe Admin)
app.post('/api/rewards', authenticateToken, requireCafeAdmin, async (req, res) => {
  const { title, cost, description, icon, cafeId } = req.body;

  if (!title || !cost) {
    return res.status(400).json({ error: 'Başlık ve maliyet zorunludur.' });
  }

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        `INSERT INTO rewards (title, cost, description, icon, cafe_id) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [title, cost, description || '', icon || 'coffee', cafeId || null]
      );

      res.json({ success: true, reward: result.rows[0] });
    } catch (err) {
      console.error('Reward creation error:', err);
      res.status(500).json({ error: 'Ödül oluşturulamadı.' });
    }
  } else {
    res.status(501).json({ error: 'Demo modda ödül oluşturulamaz.' });
  }
});

// 5.2 GET REWARDS (optionally by cafe)
app.get('/api/rewards', cache(600), async (req, res) => {
  const { cafeId } = req.query;

  if (await isDbConnected()) {
    try {
      let query = 'SELECT * FROM rewards WHERE is_active = true';
      let params = [];

      if (cafeId) {
        query += ' AND (cafe_id = $1 OR cafe_id IS NULL)';
        params.push(cafeId);
      }

      query += ' ORDER BY cost ASC';

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (err) {
      console.error('Error fetching rewards:', err);
      res.status(500).json({ error: 'Ödüller yüklenemedi.' });
    }
  } else {
    res.json([]);
  }
});

// 5.3 DELETE REWARD (Cafe Admin)
app.delete('/api/rewards/:id', authenticateToken, requireCafeAdmin, async (req, res) => {
  const { id } = req.params;

  if (await isDbConnected()) {
    try {
      const result = await pool.query(
        'UPDATE rewards SET is_active = false WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Ödül bulunamadı.' });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Reward deletion error:', err);
      res.status(500).json({ error: 'Ödül silinemedi.' });
    }
  } else {
    res.status(501).json({ error: 'Demo modda ödül silinemez.' });
  }
});

// 2.6 FUNCTIONS REMOVED (Moved to backend/utils/geo.js)

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
  const { player, move, gameState, scoreSubmission } = req.body; // player: 'host' or 'guest'

  if (await isDbConnected()) {
    try {
      if (scoreSubmission && scoreSubmission.username) {
        const username = String(scoreSubmission.username).trim();
        const scorePayload = {
          score: Number(scoreSubmission.score || 0),
          roundsWon: Number(scoreSubmission.roundsWon || 0),
          durationMs: Number(scoreSubmission.durationMs || 0),
          submittedAt: new Date().toISOString(),
        };

        const result = await pool.query(
          `
            UPDATE games
            SET game_state = jsonb_set(
              COALESCE(game_state, '{}'::jsonb),
              ARRAY['results', $1::text],
              $2::jsonb,
              true
            )
            WHERE id = $3
            RETURNING game_state as "gameState"
          `,
          [username, JSON.stringify(scorePayload), id]
        );

        return res.json({
          success: true,
          gameState: result.rows[0]?.gameState || null,
        });
      }

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
    } catch (err) {
      console.error('Game move update error:', err);
      res.status(500).json({ error: 'Hamle kaydedilemedi.' });
    }
  } else {
    // Memory fallback
    const game = MEMORY_GAMES.find(g => g.id == id);
    if (game && scoreSubmission && scoreSubmission.username) {
      const username = String(scoreSubmission.username).trim();
      game.gameState = game.gameState || {};
      game.gameState.results = game.gameState.results || {};
      game.gameState.results[username] = {
        score: Number(scoreSubmission.score || 0),
        roundsWon: Number(scoreSubmission.roundsWon || 0),
        durationMs: Number(scoreSubmission.durationMs || 0),
        submittedAt: new Date().toISOString(),
      };
    }
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



// 7. SHOP: BUY ITEM - PROTECTED (Fixed IDOR & Race Condition)
app.post('/api/shop/buy', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { rewardId, item } = req.body;
  const requestedRewardId = rewardId || item?.id;

  if (!requestedRewardId) {
    return res.status(400).json({ error: 'rewardId is required' });
  }

  if (await isDbConnected()) {
    const client = await pool.connect();
    try {
      // Start transaction to prevent race condition
      await client.query('BEGIN');

      // 1. Lock user row and check points (FOR UPDATE prevents race condition)
      const userRes = await client.query(
        'SELECT points FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      // Always read reward cost/title from DB, do not trust client-provided price/title.
      const rewardRes = await client.query(
        'SELECT id, title, cost FROM rewards WHERE id = $1 AND is_active = true',
        [requestedRewardId]
      );

      if (rewardRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Reward not found' });
      }

      const reward = rewardRes.rows[0];
      const currentPoints = userRes.rows[0].points;
      if (currentPoints < reward.cost) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Yetersiz puan.' });
      }

      // 2. Deduct points
      const newPoints = currentPoints - reward.cost;
      await client.query('UPDATE users SET points = $1 WHERE id = $2', [newPoints, userId]);

      // 3. Add to inventory
      const crypto = require('crypto');
      const code = `CD-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const redeemRes = await client.query(
        'INSERT INTO user_items (user_id, item_id, item_title, code) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, reward.id, reward.title, code]
      );

      // Commit transaction
      await client.query('COMMIT');

      res.json({ success: true, newPoints, reward: redeemRes.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Shop buy error:', err);
      res.status(500).json({ error: 'İşlem başarısız.' });
    } finally {
      client.release();
    }
  } else {
    res.status(500).json({ error: 'Veritabanı bağlantısı yok.' });
  }
});

// Get User Items (Coupons) - PROTECTED
app.get('/api/users/:id/items', authenticateToken, requireOwnership('id'), async (req, res) => {
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
app.post('/api/coupons/use', authenticateToken, requireCafeAdmin, async (req, res) => {
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

// Duplicate Get Cafes (Removed)

// Create Cafe Admin (Super Admin only) - PROTECTED
app.post('/api/admin/cafe-admins', authenticateToken, requireAdmin, async (req, res) => {
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

// 8. SHOP: GET INVENTORY - PROTECTED
app.get('/api/shop/inventory/:userId', authenticateToken, requireOwnership('userId'), async (req, res) => {
  const userId = req.user.id; // SECURITY FIX: Use authenticated user ID
  if (await isDbConnected()) {
    // Filter expired coupons (5 days)
    const result = await pool.query("SELECT * FROM user_items WHERE user_id = $1 AND redeemed_at > NOW() - INTERVAL '5 days' ORDER BY redeemed_at DESC", [userId]);
    // Map to frontend format
    const rewards = result.rows.map(row => ({
      redeemId: row.id,
      id: row.item_id,
      title: row.item_title,
      code: row.code,
      redeemedAt: row.redeemed_at,
      isUsed: row.is_used || false
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

// NOTE: Duplicate admin endpoints removed. Using protected versions above.

// CHECK-IN (Moved to cafeController)

// 19.5 UPDATE CAFE PIN (For Cafe Admins) - YENİ VERSİYON
// userId ile çalışır, cafe_id'yi veritabanından alır
// 19.5 UPDATE CAFE PIN (Moved to cafeController)

// 20. ADMIN: CREATE CAFE - PROTECTED
app.post('/api/admin/cafes', authenticateToken, requireAdmin, async (req, res) => {
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

// 10. ADMIN: DELETE USER - PROTECTED
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (Number(id) === Number(req.user.id)) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
  }
  if (await isDbConnected()) {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } else {
    MEMORY_USERS = MEMORY_USERS.filter(u => u.id != id);
    res.json({ success: true });
  }
});

// Duplicate /api/rewards endpoints removed. The secured canonical handlers are defined above.

// 15. LEADERBOARD
app.get('/api/leaderboard', cache(60), async (req, res) => { // Cache for 1 min (Real-time critical)
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
        ORDER BY created_at DESC
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

// Hook into User Update to check achievements - PROTECTED
app.put('/api/users/:id', authenticateToken, requireOwnership('id'), async (req, res) => {
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

    // Check achievements asynchronously (don't await)
    checkAchievements(id);

    res.json(user);
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

// HEALTH CHECK ENDPOINT (for Docker/load balancers)
app.get('/health', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    database: false
  };

  try {
    healthcheck.database = await isDbConnected();
    if (healthcheck.database) {
      res.status(200).json(healthcheck);
    } else {
      healthcheck.message = 'Database disconnected - Running in memory mode';
      res.status(200).json(healthcheck);
    }
  } catch (err) {
    healthcheck.message = err.message;
    res.status(503).json(healthcheck);
  }
});

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

// NOTE: Duplicate endpoints removed. Protected versions are defined above.

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  // Log error with context
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      error: 'Referenced resource not found',
      code: 'FOREIGN_KEY_VIOLATION'
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(403).json({
      error: 'Invalid token',
      code: 'TOKEN_INVALID'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(403).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED'
    });
  }

  // Default error response
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(isDev && { stack: err.stack })
  });
});

// ==========================================
// PROCESS ERROR HANDLERS
// ==========================================

process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception', err);

  // Graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('CRITICAL: Unhandled Rejection', { reason, promise });

  // Graceful shutdown
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Graceful shutdown on SIGTERM/SIGINT
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

// Initialize DB and start server
initDb().then(async () => {
  await promoteBootstrapAdmins();

  const startServer = (portToUse) => {
    server.listen(portToUse, () => {
      console.log(`🚀 Server running on http://localhost:${portToUse}`);
    });
  };

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const fallbackPort = Number(PORT) + 1;
      console.warn(`⚠️  Port ${PORT} is in use. Trying ${fallbackPort}...`);
      startServer(fallbackPort);
      return;
    }
    console.error('Server error:', err);
  });

  startServer(PORT);
});
