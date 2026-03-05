#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const MIGRATIONS_TABLE = String(process.env.MIGRATIONS_TABLE || 'pgmigrations').trim();
const MIGRATIONS_SCHEMA = String(process.env.MIGRATIONS_SCHEMA || 'public').trim();

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

const resolvePgConfig = () => {
  const dbHostFromUrl = getHostFromDatabaseUrl(process.env.DATABASE_URL);
  const resolvedHost = process.env.DB_HOST || dbHostFromUrl || 'localhost';
  const explicitSsl = parseBool(process.env.DB_SSL);
  const useSslByDefault = process.env.NODE_ENV === 'production' && !isLocalHost(resolvedHost);
  const useSsl = explicitSsl ?? useSslByDefault;
  const sslRejectUnauthorized = parseBool(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? false;
  const port = Number(process.env.DB_PORT || 5432);

  return {
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: sslRejectUnauthorized } : false,
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'cafeduo',
    password: process.env.DB_PASSWORD || 'password',
    port: Number.isFinite(port) ? port : 5432,
    connectionTimeoutMillis: 5000,
  };
};

const assertIdentifier = (value, label) => {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
};

const normalizeMigrationName = (name) => String(name || '').replace(/\.js$/i, '');

const listLocalMigrationFiles = () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name)
    .sort();
};

const fetchAppliedMigrations = async (pool) => {
  const schema = assertIdentifier(MIGRATIONS_SCHEMA, 'migration schema');
  const table = assertIdentifier(MIGRATIONS_TABLE, 'migration table');
  const qualified = `${schema}.${table}`;

  const existsResult = await pool.query(
    'SELECT to_regclass($1) AS relation_name',
    [qualified]
  );

  if (!existsResult.rows?.[0]?.relation_name) {
    return {
      tableExists: false,
      rows: [],
    };
  }

  const query = `
    SELECT id, name, run_on
    FROM "${schema}"."${table}"
    ORDER BY run_on ASC, id ASC
    LIMIT 10000
  `;
  const appliedResult = await pool.query(query);
  return {
    tableExists: true,
    rows: appliedResult.rows || [],
  };
};

const printSection = (title, entries) => {
  console.log(`${title}: ${entries.length}`);
  if (entries.length === 0) {
    console.log('  - none');
    return;
  }

  entries.forEach((entry) => {
    console.log(`  - ${entry}`);
  });
};

const main = async () => {
  const localFiles = listLocalMigrationFiles();
  const localNormalized = new Set(localFiles.map(normalizeMigrationName));
  let appliedRows = [];
  let dbReachable = false;
  let tableExists = false;
  let dbErrorMessage = '';

  const pool = new Pool(resolvePgConfig());
  try {
    const result = await fetchAppliedMigrations(pool);
    appliedRows = result.rows;
    tableExists = result.tableExists;
    dbReachable = true;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    dbErrorMessage = String(rawMessage || '').trim() || 'connection failed';
  } finally {
    await pool.end().catch(() => {});
  }

  const appliedNames = appliedRows.map((row) => String(row.name || ''));
  const appliedNormalized = new Set(appliedNames.map(normalizeMigrationName));

  const pending = localFiles.filter(
    (fileName) => !appliedNormalized.has(normalizeMigrationName(fileName))
  );

  const orphanApplied = appliedNames.filter(
    (name) => !localNormalized.has(normalizeMigrationName(name))
  );

  console.log('Migration status');
  console.log(`Migrations dir: ${MIGRATIONS_DIR}`);
  if (!dbReachable) {
    console.log(`Database: unreachable (${dbErrorMessage})`);
    console.log('Database-applied list is unavailable. Pending list is derived from local files.');
  } else if (!tableExists) {
    console.log(`Database: connected (table "${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}" not found)`);
  } else {
    console.log(`Database: connected (table "${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}")`);
  }

  const appliedDisplay = appliedRows.map((row) => {
    const runOn = row.run_on ? new Date(row.run_on).toISOString() : 'unknown-time';
    return `${row.name} (${runOn})`;
  });

  printSection('Applied', appliedDisplay);
  printSection('Pending', pending);
  printSection('Applied but missing locally', orphanApplied);
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration status failed: ${message}`);
  process.exitCode = 1;
});
