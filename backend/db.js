const { Pool } = require('pg');
require('dotenv').config();

const parseBool = (value) => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
};

const getHostFromDatabaseUrl = (databaseUrl) => {
  if (!databaseUrl) return undefined;
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return undefined;
  }
};

const isLocalHost = (host) => ['localhost', '127.0.0.1', 'postgres', 'db'].includes(host || '');
const dbHostFromUrl = getHostFromDatabaseUrl(process.env.DATABASE_URL);
const resolvedHost = process.env.DB_HOST || dbHostFromUrl || 'localhost';
const explicitSsl = parseBool(process.env.DB_SSL);
const useSslByDefault = process.env.NODE_ENV === 'production' && !isLocalHost(resolvedHost);
const useSsl = explicitSsl ?? useSslByDefault;
const sslRejectUnauthorized = parseBool(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: sslRejectUnauthorized } : false,
  
  // Pool size configuration (OPTIMIZATIONS.md Finding 7)
  max: Number(process.env.DB_POOL_MAX || 20), // Maximum connections
  min: Number(process.env.DB_POOL_MIN || 2),  // Minimum idle connections
  
  // Connection lifecycle
  idleTimeoutMillis: 30000,  // Release idle connections after 30s
  connectionTimeoutMillis: 5000, // Max wait time for connection from pool
  maxUses: 7500, // Retire connections after 7500 uses (prevent leaks)
  
  // Health checks
  allowExitOnIdle: false, // Keep pool alive
  
  // Fallback for local dev if DATABASE_URL is not set
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'cafeduo',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Pool event monitoring
pool.on('error', (err) => {
  logger.error('Unexpected pool error', { error: err.message, stack: err.stack });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

pool.on('acquire', () => {
  logger.debug('Connection acquired from pool', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
});

const logger = require('./utils/logger');
const DB_STATUS_CACHE_MS = Number(process.env.DB_STATUS_CACHE_MS || 5000);

let dbStatusCache = {
  value: false,
  checkedAt: 0,
  inFlight: null,
};

// Connection test
// Connection Test with Retry Logic
const connectWithRetry = (attempts = 5) => {
  pool.connect((err, client, release) => {
    if (err) {
      logger.error(`❌ DB Connection Attempt Failed: ${err.message}`);
      if (attempts > 1) {
        logger.info(`🔄 Retrying in 3 seconds... (${attempts - 1} attempts left)`);
        setTimeout(() => connectWithRetry(attempts - 1), 3000);
      } else {
        logger.error('❌ All connection attempts failed.');
        logger.warn('⚠️  UYARI: PostgreSQL bağlantısı kurulamadı.');
        logger.warn('   Sunucu "In-Memory" (Geçici Bellek) modunda çalışacak.');
      }
    } else {
      logger.info('✅ Veritabanı bağlantısı başarılı.');
      release();
    }
  });
};

connectWithRetry();

const isDbConnected = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && dbStatusCache.checkedAt > 0 && now - dbStatusCache.checkedAt < DB_STATUS_CACHE_MS) {
    return dbStatusCache.value;
  }

  if (dbStatusCache.inFlight) {
    return dbStatusCache.inFlight;
  }

  dbStatusCache.inFlight = pool
    .connect()
    .then((client) => {
      client.release();
      dbStatusCache.value = true;
      dbStatusCache.checkedAt = Date.now();
      return true;
    })
    .catch(() => {
      dbStatusCache.value = false;
      dbStatusCache.checkedAt = Date.now();
      return false;
    })
    .finally(() => {
      dbStatusCache.inFlight = null;
    });

  return dbStatusCache.inFlight;
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  isDbConnected,
};
