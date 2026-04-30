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


// Sentry APM Monitoring
const Sentry = require("@sentry/node");

// Track if Sentry was successfully initialized
let isSentryInitialized = false;

// Only initialize Sentry if DSN is provided
if (process.env.SENTRY_DSN) {
  const integrations = [];
  
  // Try to load profiling integration (optional dependency)
  try {
    const { ProfilingIntegration } = require("@sentry/profiling-node");
    integrations.push(new ProfilingIntegration());
  } catch (e) {
    console.log('⚠️  @sentry/profiling-node not available - profiling disabled');
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENa || 'development',
    tracesSampleRate: process.env.NODE_ENa === 'production' ? 0.1 : 1.0,
    profilesSampleRate: 1.0,
    integrations,
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove password_hash from user object if present
      if (event.user) {
        delete event.user.password_hash;
      }
      // Filter sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
  isSentryInitialized = true;
  console.log('✅ Sentry APM initialized');
} else {
  console.log('⚠️  SENTRY_DSN not set - APM monitoring disabled');
}

// Core dependencies
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookie = require('cookie');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { Server } = require("socket.io");

// Swagger UI
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

// Local modules
const { pool, isDbConnected } = require('./db');
const { cache, clearCache } = require('./middleware/cache'); // Redis Cache Import
const redisClient = require('./config/redis'); // Redis client
const { buildRateLimiterOptions, getPassOnStoreError } = require('./middleware/rateLimit');
const { notFoundHandler, createErrorHandler } = require('./middleware/errorContract');
const { csrfMiddleware } = require('./middleware/csrf');
const authRoutes = require('./routes/authRoutes');
const cafeRoutes = require('./routes/cafeRoutes'); // Cafe Routes Import
const storeRoutes = require('./routes/storeRoutes'); // Store Routes Import
const { createAdminRoutes } = require('./routes/adminRoutes');
const { createCommerceRoutes } = require('./routes/commerceRoutes');
const { createProfileRoutes } = require('./routes/profileRoutes');
const { createSystemRoutes } = require('./routes/systemRoutes');
const { createGameRoutes } = require('./routes/gameRoutes');
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
const { createProfileHandlers } = require('./handlers/profileHandlers');
const { createGameRepository } = require('./repositories/gameRepository');
const { createGameService } = require('./services/gameService');
const { createLobbyCacheService } = require('./services/lobbyCacheService');
const { registerGameCleanupJobs } = require('./jobs/gameCleanupJobs');
const { authenticateToken, requireOwnership } = require('./middleware/auth'); // Auth Middleware Imports
const { socketAuthMiddleware } = require('./middleware/socketAuth'); // Socket.IO Auth Middleware
const { getBlacklistFailMode, getRequiredJwtSecret } = require('./utils/securityConfig');
const {
  SUPPORTED_GAME_TYPES,
  normalizeGameType,
  normalizeTableCode,
  parseAllowedOrigins,
  parseAdminEmails,
} = require('./utils/serverConfig');

// Setup Logger
const logger = require('./utils/logger');
const handleApiError = createErrorHandler({ logger });

const BOOTSTRAP_ADMIN_EMAILS = parseAdminEmails(
  process.env.BOOTSTRAP_ADMIN_EMAILS || process.env.ADMIN_EMAILS,
  ['emin3619@gmail.com']
);
const BOOTSTRAP_ADMIN_PASSWORD = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || 'eminemre');

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
const APP_aERSION = String(process.env.APP_aERSION || process.env.aITE_APP_aERSION || 'local').trim();
const APP_BUILD_TIME = String(process.env.APP_BUILD_TIME || process.env.aITE_BUILD_TIME || '').trim();

if (process.env.TRUST_PROXY) {
  const trustProxyEnv = process.env.TRUST_PROXY.trim();
  const parsedTrustProxy = Number.isNaN(Number(trustProxyEnv))
    ? (trustProxyEnv === 'true' ? true : trustProxyEnv)
    : Number(trustProxyEnv);
  app.set('trust proxy', parsedTrustProxy);
} else if (process.env.NODE_ENa === 'production') {
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
  },
  transports: ['websocket', 'polling'], // Prefer WebSocket for lower latency
});

// Parse auth cookie from Socket.IO handshake headers for cookie-based auth.
io.use((socket, next) => {
  const cookieHeader = socket.handshake?.headers?.cookie;
  socket.request.cookies = cookieHeader ? cookie.parse(cookieHeader) : {};
  next();
});

// Apply Socket.IO authentication middleware
io.use(socketAuthMiddleware);

const normalizeSocketGameId = (gameId) => {
  const normalizedGameId = String(gameId || '').trim();
  return normalizedGameId && normalizedGameId.length <= 64 ? normalizedGameId : null;
};

const emitSocketRoomError = (socket, code) => {
  socket.emit('game_room_error', { code });
};

const isSocketAdmin = (socket) => Boolean(socket.user?.isAdmin || socket.user?.is_admin || socket.user?.role === 'admin');

const normalizeMemoryGameForSocket = (game) => game && {
  id: game.id,
  host_name: game.host_name ?? game.hostName,
  guest_name: game.guest_name ?? game.guestName,
  status: game.status,
};

const findMemorySocketGame = (normalizedGameId) => {
  if (!Array.isArray(memoryState.games)) {
    return null;
  }

  return memoryState.games.find((game) => String(game.id) === normalizedGameId) || null;
};

const canAccessGameRoom = async (socket, normalizedGameId) => {
  if (isSocketAdmin(socket)) {
    return true;
  }

  const username = socket.username || socket.user?.username;
  if (!username) {
    return false;
  }

  let game = null;
  if (await isDbConnected()) {
    const result = await pool.query(
      `SELECT id, host_name, guest_name, status
       FROM games
       WHERE id = $1
       LIMIT 1`,
      [normalizedGameId]
    );
    game = result.rows[0] || null;
  } else {
    game = normalizeMemoryGameForSocket(findMemorySocketGame(normalizedGameId));
  }

  return Boolean(game && normalizeParticipantName(username, game));
};

const isSocketInGameRoom = (socket, normalizedGameId) => socket.rooms.has(normalizedGameId);

io.on('connection', (socket) => {
  logger.info(`⚡ Client connected: ${socket.id} (User: ${socket.username})`);

  // Genel oyun odasına katılım
  socket.on('join_game', async (gameId) => {
    const normalizedGameId = normalizeSocketGameId(gameId);
    if (!normalizedGameId) {
      return;
    }

    try {
      const hasRoomAccess = await canAccessGameRoom(socket, normalizedGameId);
      if (!hasRoomAccess) {
        emitSocketRoomError(socket, 'forbidden');
        logger.warn('Blocked socket room join without game access', {
          socketId: socket.id,
          userId: socket.userId,
          gameId: normalizedGameId,
        });
        return;
      }
    } catch (err) {
      emitSocketRoomError(socket, 'access_check_failed');
      logger.error('Socket room access check failed', {
        socketId: socket.id,
        userId: socket.userId,
        gameId: normalizedGameId,
        error: err.message,
      });
      return;
    }

    socket.join(normalizedGameId);
    logger.info(`Socket ${socket.id} (${socket.username}) joined game: ${normalizedGameId}`);
  });

  // Oyun odasından ayrılma
  socket.on('leave_game', (gameId) => {
    const normalizedGameId = normalizeSocketGameId(gameId);
    if (!normalizedGameId) {
      return;
    }

    socket.leave(normalizedGameId);
    logger.info(`Socket ${socket.id} (${socket.username}) left game: ${normalizedGameId}`);
  });

  // 🔒 SECURITY: Allowed move action types for validation
  const ALLOWED_MOaE_ACTIONS = new Set([
    'shot_result', 'turn_timeout', 'game_over', 'player_left',
    'fire', 'move', 'resign', 'draw_offer',
  ]);

  socket.on('game_move', (data) => {
    const normalizedGameId = normalizeSocketGameId(data?.gameId);
    if (!normalizedGameId) return;
    if (!isSocketInGameRoom(socket, normalizedGameId)) {
      emitSocketRoomError(socket, 'not_in_room');
      return;
    }

    const move = data?.move;
    // aalidate move data size and structure
    if (move && typeof move === 'object') {
      const moveKeys = Object.keys(move);
      if (moveKeys.length > 20) return; // Prevent oversized payloads
      // aalidate action type if present
      if (move.action && !ALLOWED_MOaE_ACTIONS.has(String(move.action))) {
        logger.warn(`Blocked game_move with invalid action: ${move.action}`, { socketId: socket.id, gameId: normalizedGameId });
        return;
      }
      // Validate angle/power ranges for legacy projectile submissions
      if (typeof move.angle === 'number' && (move.angle < 0 || move.angle > 360)) return;
      if (typeof move.power === 'number' && (move.power < 0 || move.power > 200)) return;
    }

    const sanitizedMove = {
      gameId: normalizedGameId,
      move: move ?? null,
      player: socket.username, // Use authenticated username instead of client-provided player
      ts: Date.now(),
    };

    socket.to(normalizedGameId).emit('opponent_move', sanitizedMove);
  });

  // Game state sync
  socket.on('update_game_state', (data) => {
    const normalizedGameId = normalizeSocketGameId(data?.gameId);
    if (!normalizedGameId) return;
    if (!isSocketInGameRoom(socket, normalizedGameId)) {
      emitSocketRoomError(socket, 'not_in_room');
      return;
    }

    const nextState = data?.state ?? {};
    try {
      if (JSON.stringify(nextState).length > 10000) {
        emitSocketRoomError(socket, 'state_too_large');
        return;
      }
    } catch (err) {
      emitSocketRoomError(socket, 'invalid_state');
      return;
    }

    socket.to(normalizedGameId).emit('game_state_updated', nextState);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id} (User: ${socket.username})`);
  });
});

// JWT Secret from .env (required)
const JWT_SECRET = getRequiredJwtSecret();
const BLACKLIST_FAIL_MODE = getBlacklistFailMode();

// 4) START SERaER / INIT DB
logger.info("🚀 Starting Server...");
logger.info(
  "🔑 Google Client ID:",
  process.env.GOOGLE_CLIENT_ID || process.env.aITE_GOOGLE_CLIENT_ID ? "Loaded ✅" : "MISSING ❌"
);
logger.info("🗄️  Database URL:", process.env.DATABASE_URL ? "Loaded ✅" : "MISSING ❌");
logger.info('🔐 Security defaults:', {
  blacklistFailMode: BLACKLIST_FAIL_MODE,
  rateLimitPassOnStoreError: getPassOnStoreError(),
  jwtSecretLength: JWT_SECRET.length,
  nodeEnv: process.env.NODE_ENa || 'development',
});

// ==========================================
// SECURITY MIDDLEWARE - Enhanced Authentication
// ==========================================

/**
 * Enhanced JWT Authentication Middleware
 * aerifies token and fetches fresh user data from DB
 */
// Middleware (Moved to backend/middleware/auth.js)


// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // aite build için gerekli
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Socket.IO uyumluluğu
})); // Secure HTTP headers with CSP

// Sentry Request and Tracing Handlers (must be before other middleware)
// In Sentry v10+, request/tracing is automatic via instrumentation
// No need for explicit requestHandler/tracingHandler

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

app.use(cookieParser());

// CSRF Protection - Double Submit Cookie Pattern
// Must come after cookieParser and before routes
app.use(csrfMiddleware);

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      logger.warn(`Blocked CORS request from: ${origin}`);
      const corsError = new Error('Origin not allowed');
      corsError.status = 403;
      corsError.code = 'CORS_ORIGIN_BLOCKED';
      corsError.details = { origin: String(origin || '') };
      callback(corsError);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb', parameterLimit: 100 }));


// Initialize Database Schema (Robust aersion)
const initDb = async () => {
  if (await isDbConnected()) {
    try {
      logger.info('🔄 aeritabanı şeması kontrol ediliyor...');

      // 1. Users Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username aARCHAR(255) NOT NULL,
          email aARCHAR(255) UNIQUE NOT NULL,
          password_hash aARCHAR(255) NOT NULL,
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
          token_hash aARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used_at TIMESTAMP WITH TIME ZONE,
          request_ip aARCHAR(64),
          user_agent aARCHAR(255),
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
          name aARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Games Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS games (
          id SERIAL PRIMARY KEY,
          host_name aARCHAR(255) NOT NULL,
          guest_name aARCHAR(255),
          game_type aARCHAR(50) NOT NULL,
          points INTEGER NOT NULL,
          table_code aARCHAR(50) NOT NULL,
          status aARCHAR(20) DEFAULT 'waiting',
          player1_move aARCHAR(50),
          player2_move aARCHAR(50),
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
          item_title aARCHAR(255) NOT NULL,
          code aARCHAR(50) NOT NULL,
          redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Rewards Table (Dynamic System)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS rewards (
          id SERIAL PRIMARY KEY,
          title aARCHAR(255) NOT NULL,
          cost INTEGER NOT NULL,
          description TEXT,
          icon aARCHAR(50),
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
          logger.warn(`⚠️ Sütun eklenemedi: ${table}.${column} - ${e.message}`);
        }
      };
      const createIndex = async (indexName, query) => {
        try {
          await pool.query(query);
        } catch (e) {
          logger.warn(`⚠️ Index oluşturulamadı: ${indexName} - ${e.message}`);
        }
      };

      await addColumn('users', 'department', 'aARCHAR(255)');
      await addColumn('users', 'is_admin', 'BOOLEAN DEFAULT FALSE');
      await addColumn('users', 'role', "aARCHAR(50) DEFAULT 'user'");
      await addColumn('users', 'cafe_id', 'INTEGER REFERENCES cafes(id)');
      await addColumn('users', 'table_number', 'aARCHAR(10)'); // Store table number (e.g. "5" or "MASA05")
      await addColumn('users', 'last_daily_bonus', 'DATE');
      await addColumn('users', 'avatar_url', 'aARCHAR(500)'); // Store Google Profile Picture URL

      await addColumn('user_items', 'is_used', 'BOOLEAN DEFAULT FALSE');
      await addColumn('user_items', 'used_at', 'TIMESTAMP WITH TIME ZONE');

      // Games Table Updates
      await addColumn('games', 'guest_name', 'aARCHAR(255)');
      await addColumn('games', 'player1_move', 'aARCHAR(50)');
      await addColumn('games', 'player2_move', 'aARCHAR(50)');
      await addColumn('games', 'game_state', 'JSONB');
      await addColumn('games', 'winner', 'aARCHAR(255)');

      // Cafes Table Updates (Location System)
      await addColumn('cafes', 'latitude', 'DECIMAL(10, 8)');
      await addColumn('cafes', 'longitude', 'DECIMAL(11, 8)');
      await addColumn('cafes', 'table_count', 'INTEGER DEFAULT 20');
      await addColumn('cafes', 'radius', 'INTEGER DEFAULT 500'); // Meters
      await addColumn('cafes', 'secondary_latitude', 'DECIMAL(10, 8)');
      await addColumn('cafes', 'secondary_longitude', 'DECIMAL(11, 8)');
      await addColumn('cafes', 'secondary_radius', 'INTEGER');
      await addColumn('cafes', 'daily_pin', "aARCHAR(6) DEFAULT '0000'"); // Daily PIN code

      // 7. Performance Indexes (Sprint 5)
      await createIndex(
        'idx_games_status_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_status_created_at ON games (status, created_at DESC)'
      );
      await createIndex(
        'idx_games_status_table_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_status_table_created_at ON games (status, table_code, created_at DESC)'
      );
      await createIndex(
        'idx_games_status_type_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_status_type_created_at ON games (status, game_type, created_at DESC)'
      );
      await createIndex(
        'idx_games_status_host_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_status_host_created_at ON games (status, host_name, created_at DESC)'
      );
      await createIndex(
        'idx_games_status_guest_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_status_guest_created_at ON games (status, guest_name, created_at DESC)'
      );
      await createIndex(
        'idx_games_host_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_host_created_at ON games (host_name, created_at DESC)'
      );
      await createIndex(
        'idx_games_guest_created_at',
        'CREATE INDEX IF NOT EXISTS idx_games_guest_created_at ON games (guest_name, created_at DESC)'
      );
      await createIndex(
        'idx_users_lower_username_cafe',
        'CREATE INDEX IF NOT EXISTS idx_users_lower_username_cafe ON users ((LOWER(username)), cafe_id)'
      );
      await createIndex(
        'idx_users_cafe_table_number',
        'CREATE INDEX IF NOT EXISTS idx_users_cafe_table_number ON users (cafe_id, table_number)'
      );
      await createIndex(
        'idx_user_items_user_is_used',
        'CREATE INDEX IF NOT EXISTS idx_user_items_user_is_used ON user_items (user_id, is_used)'
      );

      // 7. Seed Initial Cafes
      await pool.query(`INSERT INTO cafes (name, table_count, radius, daily_pin) aALUES ('PAÜ İİBF Kantin', 50, 150, '1234'), ('PAÜ Yemekhane', 100, 200, '5678') ON CONFLICT (name) DO NOTHING`);

      // 9. Achievements Table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS achievements (
          id SERIAL PRIMARY KEY,
          title aARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          icon aARCHAR(50) NOT NULL,
          points_reward INTEGER NOT NULL,
          condition_type aARCHAR(50) NOT NULL, -- e.g., 'wins', 'games_played', 'points'
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
            INSERT INTO achievements (title, description, icon, points_reward, condition_type, condition_value) aALUES
            ('İlk Adım', 'İlk oyununu oyna.', 'footsteps', 50, 'games_played', 1),
            ('Acemi Şanslı', 'İlk galibiyetini al.', 'trophy', 100, 'wins', 1),
            ('Oyun Kurdu', '10 oyun oyna.', 'gamepad', 200, 'games_played', 10),
            ('Yenilmez', '10 galibiyet al.', 'crown', 500, 'wins', 10),
            ('Zengin', '1000 puana ulaş.', 'coins', 300, 'points', 1000)
          `);
        logger.info('🏆 Başlangıç başarımları eklendi.');
        clearCache('achievements:*');
      }

      // 8. Seed Initial Rewards (If there is no active reward left)
      const rewardsCheck = await pool.query('SELECT COUNT(*) FROM rewards WHERE is_active = true');
      if (parseInt(rewardsCheck.rows[0].count) === 0) {
        await pool.query(`
            INSERT INTO rewards (title, cost, description, icon, is_active) aALUES
            ('Bedava Filtre Kahve', 500, 'Günün yorgunluğunu at.', 'coffee', true),
            ('%20 Hesap İndirimi', 850, 'Tüm masada geçerli.', 'discount', true),
            ('Cheesecake İkramı', 400, 'Tatlı bir mola ver.', 'dessert', true),
            ('Oyun Jetonu x5', 100, 'Ekstra oyun hakkı.', 'game', true)
          `);
        logger.info('🎁 Başlangıç ödülleri eklendi.');
        clearCache('rewards:*');
      }

      logger.info('✅ aeritabanı şeması başarıyla güncellendi.');
    } catch (err) {
      logger.error('❌ Kritik Şema Hatası:', err);
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

const gameRepository = createGameRepository({
  pool,
  supportedGameTypes: SUPPORTED_GAME_TYPES,
});

const lobbyCacheService = createLobbyCacheService({
  redisClient,
});

const gameService = createGameService({
  isDbConnected,
  gameRepository,
  lobbyCacheService,
  getMemoryGames: () => MEMORY_GAMES,
  getMemoryUsers: () => MEMORY_USERS,
  supportedGameTypes: SUPPORTED_GAME_TYPES,
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
  gameService,
  lobbyCacheService,
  getMemoryGames: () => MEMORY_GAMES,
  setMemoryGames: (nextGames) => {
    MEMORY_GAMES = nextGames;
    memoryState.games = nextGames;
  },
  getMemoryUsers: () => MEMORY_USERS,
});

const profileHandlers = createProfileHandlers({
  pool,
  isDbConnected,
  logger,
  getMemoryUsers: () => MEMORY_USERS,
  setMemoryUsers: (nextUsers) => {
    MEMORY_USERS = nextUsers;
    memoryState.users = nextUsers;
  },
});

const gameRoutes = createGameRoutes({
  authenticateToken,
  gameHandlers,
  gameService,
});

const adminRoutes = createAdminRoutes({
  authenticateToken,
  adminHandlers,
});

const commerceRoutes = createCommerceRoutes({
  authenticateToken,
  cache,
  commerceHandlers,
});

const profileRoutes = createProfileRoutes({
  cache,
  authenticateToken,
  requireOwnership,
  profileHandlers,
});

const systemRoutes = createSystemRoutes({
  appaersion: APP_aERSION,
  appBuildTime: APP_BUILD_TIME,
  isDbConnected,
  getRedisStatus: () => ({
    status: redisClient.status || 'unknown',
    ready: redisClient.status === 'ready',
  }),
  getSocketStatus: () => ({
    connectedClients: io.engine.clientsCount || 0,
  }),
});

const promoteBootstrapAdmins = async () => {
  if (BOOTSTRAP_ADMIN_EMAILS.length === 0) return;

  const syncMemoryBootstrapAdmins = async () => {
    const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);
    let nextId = MEMORY_USERS.reduce((max, user) => Math.max(max, Number(user.id) || 0), 0) + 1;

    BOOTSTRAP_ADMIN_EMAILS.forEach((email) => {
      const existing = MEMORY_USERS.find(
        (user) => String(user.email || '').trim().toLowerCase() === email
      );

      if (existing) {
        existing.password_hash = passwordHash;
        existing.role = 'admin';
        existing.isAdmin = true;
        existing.is_admin = true;
        existing.cafe_id = null;
        existing.table_number = null;
        return;
      }

      MEMORY_USERS.unshift({
        id: nextId,
        username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) || `admin_${nextId}`,
        email,
        password_hash: passwordHash,
        points: 100,
        wins: 0,
        gamesPlayed: 0,
        games_played: 0,
        department: 'Admin',
        role: 'admin',
        isAdmin: true,
        is_admin: true,
        cafe_id: null,
        table_number: null,
      });
      nextId += 1;
    });

    memoryState.users = MEMORY_USERS;
  };

  if (!(await isDbConnected())) {
    await syncMemoryBootstrapAdmins();
    logger.warn('Bootstrap admin sync used memory fallback: database is not connected.', {
      targetEmails: BOOTSTRAP_ADMIN_EMAILS,
    });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD, 10);
    let affectedRows = 0;

    for (const email of BOOTSTRAP_ADMIN_EMAILS) {
      const username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) || 'admin';
      const result = await pool.query(
        `INSERT INTO users (username, email, password_hash, points, department, role, is_admin, cafe_id)
         aALUES ($1, $2, $3, 100, 'Admin', 'admin', true, NULL)
         ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             role = 'admin',
             is_admin = true,
             cafe_id = NULL
         RETURNING id`,
        [username, email, passwordHash]
      );
      affectedRows += result.rowCount;
    }

    logger.info('Bootstrap admin upsert completed.', {
      targetEmails: BOOTSTRAP_ADMIN_EMAILS,
      affectedRows,
    });
  } catch (upsertError) {
    logger.warn('Bootstrap admin upsert failed, falling back to promotion-only sync.', upsertError);
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
    } catch (promotionError) {
      logger.error('Bootstrap admin sync failed.', promotionError);
    }
  }
};

registerGameCleanupJobs({
  pool,
  isDbConnected,
  getMemoryGames: () => MEMORY_GAMES,
  setMemoryGames: (nextGames) => {
    MEMORY_GAMES = nextGames;
    memoryState.games = nextGames;
  },
  logger,
});

// --- SWAGGER UI ---
try {
  const swaggerDocument = YAML.load(path.resolve(__dirname, '../openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'CafeDuo API Documentation',
  }));
  console.log('✅ Swagger UI available at /api-docs');
} catch (swaggerErr) {
  console.warn('⚠️  Swagger UI not loaded:', swaggerErr.message);
}

// --- API ROUTES ---

// Auth Routes (Modularized)
app.use('/api/auth', authRoutes);

// Cafe Routes (Modularized)
app.use('/api/cafes', cafeRoutes);

// Store Routes (Phase 3)
app.use('/api/store', storeRoutes);

// 3. CAFE ENDPOINTS (Moved to cafeController)

// 3.3 CHECK-IN (Moved to cafeController)

// 3.4 UPDATE PIN (Moved to cafeController)

// Admin Routes (Modularized)
app.use('/api/admin', adminRoutes);

// Commerce/Rewards Routes (Modularized)
app.use('/api', commerceRoutes);

// 2.6 FUNCTIONS REMOaED (Moved to backend/utils/geo.js)

// 6. GAME ROUTES (Modularized)
app.use('/api', gameRoutes);

// Profile/Leaderboard Routes (Modularized)
app.use('/api', profileRoutes);

// System Routes (health/meta/root)
app.use('/', systemRoutes);

// NOTE: Duplicate admin endpoints removed. Using protected versions above.

// CHECK-IN (Moved to cafeController)

// 19.5 UPDATE CAFE PIN (For Cafe Admins) - YENİ aERSİYON
// userId ile çalışır, cafe_id'yi veritabanından alır
// 19.5 UPDATE CAFE PIN (Moved to cafeController)

// 20. ADMIN: CREATE CAFE -> duplicated route removed.

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// ... (keep existing API routes)

// Duplicate /api/rewards endpoints removed. The secured canonical handlers are defined above.

// NOTE: Duplicate endpoints removed. Protected versions are defined above.

// ==========================================
// GLOBAL ERROR HANDLING
// ==========================================

// Debug endpoint for testing Sentry integration
app.get('/debug-sentry', (req, res) => {
  throw new Error('Sentry test error!');
});

// Sentry Error Handler (must be before other error handlers)
if (isSentryInitialized) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(notFoundHandler);
app.use(handleApiError);

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
      logger.info(`🚀 Server running on http://localhost:${portToUse}`);
    });
  };

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Server will exit to avoid mismatched proxy routing.`);
      process.exit(1);
      return;
    }
    logger.error('Server error:', err);
  });

  startServer(PORT);
});
