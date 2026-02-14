const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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
const { Server } = require("socket.io");

// Local modules
const { pool, isDbConnected } = require('./db');
const { cache, clearCache } = require('./middleware/cache'); // Redis Cache Import
const { buildRateLimiterOptions } = require('./middleware/rateLimit');
const authRoutes = require('./routes/authRoutes');
const cafeRoutes = require('./routes/cafeRoutes'); // Cafe Routes Import
const memoryState = require('./store/memoryState');
const {
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
} = require('./utils/gameResults');
const {
  normalizeCafeCreatePayload,
  normalizeCafeUpdatePayload,
} = require('./utils/cafeAdminValidation');
const { createAdminHandlers } = require('./handlers/adminHandlers');
const { createCommerceHandlers } = require('./handlers/commerceHandlers');
const { createGameHandlers } = require('./handlers/gameHandlers');
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
  'https://cafeduo-api.onrender.com'
];
const LOCAL_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const SUPPORTED_GAME_TYPES = new Set([
  'Refleks Avı',
  'Tank Düellosu',
  'Retro Satranç',
  'Bilgi Yarışı',
]);

const normalizeGameType = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (SUPPORTED_GAME_TYPES.has(raw)) return raw;

  const aliasMap = {
    refleks: 'Refleks Avı',
    reflex: 'Refleks Avı',
    rps: 'Refleks Avı',
    arena: 'Tank Düellosu',
    rhythm: 'Tank Düellosu',
    ritim_kopyala: 'Tank Düellosu',
    tank: 'Tank Düellosu',
    tank_duellosu: 'Tank Düellosu',
    chess: 'Retro Satranç',
    satranc: 'Retro Satranç',
    retro_satranc: 'Retro Satranç',
    strategy: 'Retro Satranç',
    dungeon: 'Retro Satranç',
    odd_even: 'Retro Satranç',
    odd_even_sprint: 'Retro Satranç',
    sprint: 'Retro Satranç',
    cift_tek_sprint: 'Retro Satranç',
    knowledge: 'Bilgi Yarışı',
    quiz: 'Bilgi Yarışı',
    trivia: 'Bilgi Yarışı',
    bilgi: 'Bilgi Yarışı',
    bilgi_yarisi: 'Bilgi Yarışı',
  };

  const normalizedKey = raw
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return aliasMap[normalizedKey] || null;
};

const normalizeTableCode = (rawValue) => {
  const raw = String(rawValue || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith('MASA')) return raw;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric > 0) {
    return `MASA${String(numeric).padStart(2, '0')}`;
  }
  return null;
};

const parseAllowedOrigins = (originsValue) => {
  const parsed = (originsValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const baseOrigins = parsed.length > 0 ? parsed : DEFAULT_ALLOWED_ORIGINS;
  // Localhost UI (dev, e2e, smoke) her zaman güvenli şekilde erişebilsin.
  return Array.from(new Set([...baseOrigins, ...LOCAL_ALLOWED_ORIGINS]));
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
// API cevaplarında koşullu 304 akışını kapat; token restore sırasında false-negative logout üretiyordu.
app.set('etag', false);
app.disable('x-powered-by');
const PORT = process.env.PORT || 3001;
const REQUEST_LOG_SLOW_MS = Number(process.env.REQUEST_LOG_SLOW_MS || 1200);
const LEGACY_RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const LEGACY_RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 0);
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS || LEGACY_RATE_LIMIT_WINDOW_MS);
const API_RATE_LIMIT_MAX_REQUESTS =
  Number(process.env.API_RATE_LIMIT_MAX_REQUESTS || 0) || Math.max(LEGACY_RATE_LIMIT_MAX_REQUESTS, 600);
const APP_VERSION = String(process.env.APP_VERSION || process.env.VITE_APP_VERSION || 'local').trim();
const APP_BUILD_TIME = String(process.env.APP_BUILD_TIME || process.env.VITE_BUILD_TIME || '').trim();

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

app.use((req, res, next) => {
  const incomingRequestId = String(req.headers['x-request-id'] || '').trim();
  const requestId = incomingRequestId || crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  res.once('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const payload = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userId: req.user?.id || null,
    };

    if (res.statusCode >= 500) {
      logger.error('HTTP request failed', payload);
      return;
    }

    if (res.statusCode >= 400 || durationMs >= REQUEST_LOG_SLOW_MS) {
      logger.warn('HTTP request completed with warning', payload);
      return;
    }

    logger.info('HTTP request completed', payload);
  });

  next();
});

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // Genel oyun odasına katılım
  socket.on('join_game', (gameId) => {
    const normalizedGameId = String(gameId || '').trim();
    if (!normalizedGameId || normalizedGameId.length > 64) {
      return;
    }

    socket.join(normalizedGameId);
    console.log(`Socket ${socket.id} joined game: ${normalizedGameId}`);
  });

  socket.on('game_move', (data) => {
    const normalizedGameId = String(data?.gameId || '').trim();
    if (!normalizedGameId || normalizedGameId.length > 64) return;

    const sanitizedMove = {
      gameId: normalizedGameId,
      move: data?.move ?? null,
      player: typeof data?.player === 'string' ? data.player.slice(0, 64) : undefined,
      ts: Date.now(),
    };

    socket.to(normalizedGameId).emit('opponent_move', sanitizedMove);
  });

  // Game state sync
  socket.on('update_game_state', (data) => {
    const normalizedGameId = String(data?.gameId || '').trim();
    if (!normalizedGameId || normalizedGameId.length > 64) return;
    socket.to(normalizedGameId).emit('game_state_updated', data?.state ?? {});
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// JWT Secret from .env (required)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
}

console.log("🚀 Starting Server...");
console.log(
  "🔑 Google Client ID:",
  process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID ? "Loaded ✅" : "MISSING ❌"
);
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

// Apply a higher baseline limiter only to API routes.
// Auth brute-force protection is handled separately in authRoutes.
const apiLimiter = rateLimit(
  buildRateLimiterOptions({
    scope: 'api',
    windowMs: API_RATE_LIMIT_WINDOW_MS,
    limit: API_RATE_LIMIT_MAX_REQUESTS,
    skip: (req) => {
      const path = String(req.path || req.originalUrl || '');
      if (req.method !== 'GET') return false;
      // High-frequency realtime polling routes should not hit generic API limiter.
      if (/^\/games\/[^/]+$/.test(path)) return true;
      if (/^\/users\/[^/]+\/active-game$/.test(path)) return true;
      return false;
    },
    message: { error: 'Çok fazla API isteği gönderdiniz, lütfen daha sonra tekrar deneyin.' },
  })
);
app.use('/api', apiLimiter);

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
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));


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

      // Password reset tokens table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used_at TIMESTAMP WITH TIME ZONE,
          request_ip VARCHAR(64),
          user_agent VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_password_reset_lookup ON password_reset_tokens(token_hash, expires_at, used_at)'
      );
      await pool.query(
        'CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id, used_at)'
      );

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
      await addColumn('games', 'winner', 'VARCHAR(255)');

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

      // 8. Seed Initial Rewards (If there is no active reward left)
      const rewardsCheck = await pool.query('SELECT COUNT(*) FROM rewards WHERE is_active = true');
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
const memoryItems = memoryState.items;
let MEMORY_USERS = memoryState.users;
let MEMORY_GAMES = memoryState.games;
let MEMORY_REWARDS = memoryState.rewards;

const adminHandlers = createAdminHandlers({
  pool,
  isDbConnected,
  bcrypt,
  logger,
  normalizeCafeCreatePayload,
  normalizeCafeUpdatePayload,
  clearCacheByPattern: clearCache,
  getMemoryUsers: () => MEMORY_USERS,
  setMemoryUsers: (nextUsers) => {
    MEMORY_USERS = nextUsers;
    memoryState.users = nextUsers;
  },
});

const commerceHandlers = createCommerceHandlers({
  pool,
  isDbConnected,
  logger,
  getMemoryItems: () => memoryItems,
  getMemoryRewards: () => MEMORY_REWARDS,
  getMemoryUsers: () => MEMORY_USERS,
  setMemoryUsers: (nextUsers) => {
    MEMORY_USERS = nextUsers;
    memoryState.users = nextUsers;
  },
});

const gameHandlers = createGameHandlers({
  pool,
  isDbConnected,
  logger,
  io,
  supportedGameTypes: SUPPORTED_GAME_TYPES,
  normalizeGameType,
  normalizeTableCode,
  getGameParticipants,
  normalizeParticipantName,
  sanitizeScoreSubmission,
  pickWinnerFromResults,
  getMemoryGames: () => MEMORY_GAMES,
  setMemoryGames: (nextGames) => {
    MEMORY_GAMES = nextGames;
    memoryState.games = nextGames;
  },
  getMemoryUsers: () => MEMORY_USERS,
});

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
    memoryState.games = MEMORY_GAMES;
    const deletedCount = initialCount - MEMORY_GAMES.length;
    if (deletedCount > 0) {
      console.log(`🗑️ Deleted ${deletedCount} stale games from Memory.`);
    }
  }
}, 5 * 60 * 1000); // 5 minutes

// --- API ROUTES ---

// Auth Routes (Modularized)
app.use('/api/auth', authRoutes);

// Cafe Routes (Modularized)
app.use('/api/cafes', cafeRoutes);

// 3. CAFE ENDPOINTS (Moved to cafeController)

// 3.3 CHECK-IN (Moved to cafeController)

// 3.4 UPDATE PIN (Moved to cafeController)

// ===================================
// 4. ADMIN ENDPOINTS
// ===================================

// 4.1 GET ALL USERS (Admin only) - PROTECTED
app.get('/api/admin/users', authenticateToken, requireAdmin, adminHandlers.getUsers);

// 4.2 CREATE USER (Admin only) - PROTECTED
app.post('/api/admin/users', authenticateToken, requireAdmin, adminHandlers.createUser);

// 4.3 GET ALL GAMES (Admin only) - PROTECTED
app.get('/api/admin/games', authenticateToken, requireAdmin, adminHandlers.getGames);

// 4.4 UPDATE USER ROLE (Admin only) - PROTECTED
app.put('/api/admin/users/:id/role', authenticateToken, requireAdmin, adminHandlers.updateUserRole);

// 4.5 UPDATE USER POINTS (Admin only) - PROTECTED
app.patch('/api/admin/users/:id/points', authenticateToken, requireAdmin, adminHandlers.updateUserPoints);

// 4.6 UPDATE CAFE (Admin only) - PROTECTED
app.put('/api/admin/cafes/:id', authenticateToken, requireAdmin, adminHandlers.updateCafe);

// 4.7 CREATE CAFE (Admin only) - PROTECTED
app.post('/api/admin/cafes', authenticateToken, requireAdmin, adminHandlers.createCafe);

// 4.8 DELETE CAFE (Admin only) - PROTECTED
app.delete('/api/admin/cafes/:id', authenticateToken, requireAdmin, adminHandlers.deleteCafe);

// ===================================
// 5. REWARDS ENDPOINTS (for Cafe Admins)
// ===================================

// 5.1 CREATE REWARD (Cafe Admin)
app.post('/api/rewards', authenticateToken, requireCafeAdmin, commerceHandlers.createReward);

// 5.2 GET REWARDS (optionally by cafe)
app.get('/api/rewards', cache(600), commerceHandlers.getRewards);

// 5.3 DELETE REWARD (Cafe Admin)
app.delete('/api/rewards/:id', authenticateToken, requireCafeAdmin, commerceHandlers.deleteReward);

// 2.6 FUNCTIONS REMOVED (Moved to backend/utils/geo.js)

// 3. GET GAMES
app.get('/api/games', authenticateToken, gameHandlers.getGames);

// 4. CREATE GAME
app.post('/api/games', authenticateToken, gameHandlers.createGame);

// 5. JOIN GAME
app.post('/api/games/:id/join', authenticateToken, gameHandlers.joinGame);

// 6. GET GAME STATE (Polling)
app.get('/api/games/:id', authenticateToken, gameHandlers.getGameState);

// 7. MAKE MOVE
app.post('/api/games/:id/move', authenticateToken, gameHandlers.makeMove);

// 7.1 CHESS DRAW OFFER ACTIONS
app.post('/api/games/:id/draw-offer', authenticateToken, gameHandlers.drawOffer);

// 7.2 RESIGN ACTIVE GAME
app.post('/api/games/:id/resign', authenticateToken, gameHandlers.resignGame);

// 8. FINISH GAME
app.post('/api/games/:id/finish', authenticateToken, gameHandlers.finishGame);

// 9. DELETE GAME
app.delete('/api/games/:id', authenticateToken, gameHandlers.deleteGame);

// 9.1 USER GAME HISTORY
app.get('/api/users/:username/game-history', authenticateToken, gameHandlers.getUserGameHistory);



// 7. SHOP: BUY ITEM - PROTECTED (Fixed IDOR & Race Condition)
app.post('/api/shop/buy', authenticateToken, commerceHandlers.buyShopItem);

// Get User Items (Coupons) - PROTECTED
app.get('/api/users/:id/items', authenticateToken, requireOwnership('id'), commerceHandlers.getUserItems);

// Use Coupon (Cafe Admin)
app.post('/api/coupons/use', authenticateToken, requireCafeAdmin, commerceHandlers.useCoupon);

// Duplicate Get Cafes (Removed)

// Create Cafe Admin (Super Admin only) - PROTECTED
app.post('/api/admin/cafe-admins', authenticateToken, requireAdmin, adminHandlers.createCafeAdmin);

// 8. SHOP: GET INVENTORY - PROTECTED
app.get('/api/shop/inventory/:userId', authenticateToken, requireOwnership('userId'), commerceHandlers.getShopInventory);

// NOTE: Duplicate admin endpoints removed. Using protected versions above.

// CHECK-IN (Moved to cafeController)

// 19.5 UPDATE CAFE PIN (For Cafe Admins) - YENİ VERSİYON
// userId ile çalışır, cafe_id'yi veritabanından alır
// 19.5 UPDATE CAFE PIN (Moved to cafeController)

// 20. ADMIN: CREATE CAFE -> duplicated route removed.

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// ... (keep existing API routes)

// 10. ADMIN: DELETE USER - PROTECTED
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, adminHandlers.deleteUser);

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
app.get('/api/achievements/:userId', authenticateToken, requireOwnership('userId'), async (req, res) => {
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
app.get('/api/users/:username/active-game', authenticateToken, async (req, res) => {
  const { username } = req.params;
  const actor = String(req.user?.username || '').trim().toLowerCase();
  const target = String(username || '').trim().toLowerCase();
  const isAdminActor = req.user?.role === 'admin' || req.user?.isAdmin === true;
  if (!isAdminActor && actor !== target) {
    return res.status(403).json({ error: 'Sadece kendi aktif oyununuzu görüntüleyebilirsiniz.' });
  }

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
        WHERE (host_name = $1 OR guest_name = $1)
          AND status = 'active'
          AND game_type = ANY($2::text[])
        ORDER BY created_at DESC
        LIMIT 1
      `, [username, [...SUPPORTED_GAME_TYPES]]);

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
      (g.hostName === username || g.guestName === username) &&
      g.status === 'active' &&
      SUPPORTED_GAME_TYPES.has(String(g.gameType || '').trim())
    );
    res.json(game || null);
  }
});

// Hook into User Update to check achievements - PROTECTED
app.put('/api/users/:id', authenticateToken, requireOwnership('id'), async (req, res) => {
  const { id } = req.params;
  const { points, wins, gamesPlayed } = req.body;
  const nextPoints = Math.floor(Number(points));
  const nextWins = Math.floor(Number(wins));
  const nextGamesPlayed = Math.floor(Number(gamesPlayed));
  const safeDepartment = String(req.body.department || '').slice(0, 120);

  if (![nextPoints, nextWins, nextGamesPlayed].every((value) => Number.isFinite(value) && value >= 0)) {
    return res.status(400).json({ error: 'Puan, galibiyet ve oyun sayısı geçerli pozitif sayılar olmalıdır.' });
  }

  if (await isDbConnected()) {
    const result = await pool.query(
      'UPDATE users SET points = $1, wins = $2, games_played = $3, department = $4 WHERE id = $5 RETURNING id, username, email, points, wins, games_played as "gamesPlayed", department, is_admin as "isAdmin", role, cafe_id, table_number, avatar_url',
      [nextPoints, nextWins, nextGamesPlayed, safeDepartment, id]
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
      MEMORY_USERS[idx] = { ...MEMORY_USERS[idx], points: nextPoints, wins: nextWins, gamesPlayed: nextGamesPlayed };
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

app.get('/api/meta/version', (req, res) => {
  res.json({
    commit: APP_VERSION || 'local',
    buildTime: APP_BUILD_TIME || null,
    nodeEnv: process.env.NODE_ENV || 'development',
  });
});

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
    path: req.originalUrl,
    requestId: req.requestId,
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
    requestId: req.requestId,
    userId: req.user?.id,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Handle specific error types
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
      requestId: req.requestId,
    });
  }

  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      error: 'Referenced resource not found',
      code: 'FOREIGN_KEY_VIOLATION',
      requestId: req.requestId,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(403).json({
      error: 'Invalid token',
      code: 'TOKEN_INVALID',
      requestId: req.requestId,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(403).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      requestId: req.requestId,
    });
  }

  // Default error response
  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.requestId,
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
      logger.error(`Port ${PORT} is already in use. Server will exit to avoid mismatched proxy routing.`);
      process.exit(1);
      return;
    }
    console.error('Server error:', err);
  });

  startServer(PORT);
});
