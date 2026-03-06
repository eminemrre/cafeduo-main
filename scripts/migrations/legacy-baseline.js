#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const dotenvPath = process.env.DOTENV_CONFIG_PATH || process.env.ENV_FILE;
require('dotenv').config(dotenvPath ? { path: dotenvPath } : undefined);

const MIGRATIONS_SCHEMA = String(process.env.MIGRATIONS_SCHEMA || 'public').trim();
const MIGRATIONS_TABLE = String(process.env.MIGRATIONS_TABLE || 'pgmigrations').trim();
const COMMAND = String(process.argv[2] || 'report').trim().toLowerCase();
const INCLUDE_SUPERSEDED = process.argv.includes('--include-superseded-performance');
const LEGACY_PERFORMANCE_REPLACEMENT = '20260306190000_normalize_legacy_performance_indexes';
const LEGACY_PERFORMANCE_REPLACEMENT_FILE = path.resolve(
  __dirname,
  '../../migrations/20260306190000_normalize_legacy_performance_indexes.js'
);

const REQUIRED_TABLE_COLUMNS = {
  cafes: [
    'id',
    'name',
    'address',
    'total_tables',
    'pin',
    'latitude',
    'longitude',
    'radius',
    'secondary_latitude',
    'secondary_longitude',
    'secondary_radius',
    'daily_pin',
    'created_at',
  ],
  users: [
    'id',
    'username',
    'email',
    'password_hash',
    'points',
    'wins',
    'games_played',
    'department',
    'role',
    'cafe_id',
    'table_number',
    'created_at',
  ],
  password_reset_tokens: [
    'id',
    'user_id',
    'token_hash',
    'expires_at',
    'used_at',
    'request_ip',
    'user_agent',
    'created_at',
  ],
  games: [
    'id',
    'host_name',
    'guest_name',
    'game_type',
    'points',
    'table_code',
    'status',
    'player1_move',
    'player2_move',
    'game_state',
    'winner',
    'created_at',
  ],
  user_items: [
    'id',
    'user_id',
    'item_id',
    'item_title',
    'code',
    'is_used',
    'used_at',
    'redeemed_at',
  ],
};

const REQUIRED_INITIAL_INDEXES = [
  'idx_users_lower_username_cafe',
  'idx_users_cafe_table_number',
  'idx_password_reset_lookup',
  'idx_password_reset_user',
  'idx_games_status_created_at',
  'idx_games_status_table_created_at',
  'idx_games_status_type_created_at',
  'idx_games_status_host_created_at',
  'idx_games_status_guest_created_at',
  'idx_games_host_created_at',
  'idx_games_guest_created_at',
  'idx_user_items_user_is_used',
];

const LEGACY_PERFORMANCE_INDEX_MAP = [
  {
    legacy: 'idx_games_status_created',
    satisfiedBy: ['idx_games_status_created', 'idx_games_status_created_at'],
    note: 'Runtime bootstrap already creates a broader status+created_at index.',
  },
  {
    legacy: 'idx_games_status_table_created',
    satisfiedBy: ['idx_games_status_table_created', 'idx_games_status_table_created_at'],
    note: 'Runtime bootstrap already creates a broader status+table_code+created_at index.',
  },
  {
    legacy: 'idx_games_status_type_created',
    satisfiedBy: ['idx_games_status_type_created', 'idx_games_status_type_created_at'],
    note: 'Runtime bootstrap already creates a broader status+game_type+created_at index.',
  },
  {
    legacy: 'idx_games_host_status_created',
    satisfiedBy: ['idx_games_host_status_created'],
    note: 'This targeted partial index is backfilled by the replacement migration.',
  },
  {
    legacy: 'idx_games_guest_status_created',
    satisfiedBy: ['idx_games_guest_status_created'],
    note: 'This targeted partial index is backfilled by the replacement migration.',
  },
  {
    legacy: 'idx_users_username_lower_cafe',
    satisfiedBy: ['idx_users_username_lower_cafe', 'idx_users_lower_username_cafe'],
    note: 'Runtime bootstrap index is semantically equivalent.',
  },
  {
    legacy: 'idx_users_cafe_table',
    satisfiedBy: ['idx_users_cafe_table', 'idx_users_cafe_table_number'],
    note: 'Runtime bootstrap index is semantically equivalent for cafe/table lookups.',
  },
  {
    legacy: 'idx_users_points_desc',
    satisfiedBy: ['idx_users_points_desc'],
    note: 'This leaderboard index is backfilled by the replacement migration.',
  },
  {
    legacy: 'idx_users_cafe_active',
    satisfiedBy: ['idx_users_cafe_active'],
    note: 'This cafe activity index is backfilled by the replacement migration.',
  },
  {
    legacy: 'idx_user_items_user_used',
    satisfiedBy: ['idx_user_items_user_used', 'idx_user_items_user_is_used'],
    note: 'Runtime bootstrap index is semantically equivalent.',
  },
];

const MIGRATIONS_TO_BASELINE = [
  '20240224000001_initial_schema',
  '20240224000002_add_performance_indexes',
];

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

const printHeader = (title) => {
  console.log(`\n${title}`);
};

const printList = (label, entries) => {
  console.log(`${label}: ${entries.length}`);
  if (entries.length === 0) {
    console.log('  - none');
    return;
  }
  for (const entry of entries) {
    console.log(`  - ${entry}`);
  }
};

const fetchTableNames = async (pool, schemaName, tableNames) => {
  const result = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name = ANY($2::text[])
     ORDER BY table_name ASC
     LIMIT 200`,
    [schemaName, tableNames]
  );
  return new Set(result.rows.map((row) => row.table_name));
};

const fetchColumns = async (pool, schemaName, tableNames) => {
  const result = await pool.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = ANY($2::text[])
     ORDER BY table_name ASC, ordinal_position ASC
     LIMIT 2000`,
    [schemaName, tableNames]
  );

  const byTable = new Map();
  for (const row of result.rows) {
    if (!byTable.has(row.table_name)) {
      byTable.set(row.table_name, new Set());
    }
    byTable.get(row.table_name).add(row.column_name);
  }
  return byTable;
};

const fetchIndexes = async (pool, schemaName, tableNames) => {
  const result = await pool.query(
    `SELECT tablename, indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = $1
       AND tablename = ANY($2::text[])
     ORDER BY tablename ASC, indexname ASC
     LIMIT 2000`,
    [schemaName, tableNames]
  );

  const indexes = new Map();
  for (const row of result.rows) {
    indexes.set(row.indexname, row);
  }
  return indexes;
};

const fetchAppliedMigrations = async (pool, schemaName, tableName) => {
  const qualified = `${schemaName}.${tableName}`;
  const existsResult = await pool.query('SELECT to_regclass($1) AS relation_name', [qualified]);
  if (!existsResult.rows?.[0]?.relation_name) {
    return { tableExists: false, rows: [] };
  }

  const result = await pool.query(
    `SELECT id, name, run_on
     FROM "${schemaName}"."${tableName}"
     ORDER BY run_on ASC, id ASC
     LIMIT 10000`
  );

  return { tableExists: true, rows: result.rows || [] };
};

const evaluateBaseline = ({ tables, columnsByTable, indexes }) => {
  const missingTables = [];
  const missingColumns = [];
  const missingInitialIndexes = [];

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
    if (!tables.has(tableName)) {
      missingTables.push(tableName);
      continue;
    }

    const existingColumns = columnsByTable.get(tableName) || new Set();
    for (const columnName of requiredColumns) {
      if (!existingColumns.has(columnName)) {
        missingColumns.push(`${tableName}.${columnName}`);
      }
    }
  }

  for (const indexName of REQUIRED_INITIAL_INDEXES) {
    if (!indexes.has(indexName)) {
      missingInitialIndexes.push(indexName);
    }
  }

  const missingLegacyPerformance = [];
  const satisfiedLegacyPerformance = [];

  for (const entry of LEGACY_PERFORMANCE_INDEX_MAP) {
    const matched = entry.satisfiedBy.find((indexName) => indexes.has(indexName));
    if (matched) {
      satisfiedLegacyPerformance.push(`${entry.legacy} <= ${matched}`);
      continue;
    }
    missingLegacyPerformance.push(`${entry.legacy} (${entry.note})`);
  }

  return {
    missingTables,
    missingColumns,
    missingInitialIndexes,
    missingLegacyPerformance,
    satisfiedLegacyPerformance,
    initialReady:
      missingTables.length === 0 &&
      missingColumns.length === 0 &&
      missingInitialIndexes.length === 0,
    legacyPerformanceReady:
      missingLegacyPerformance.length === 0 || fs.existsSync(LEGACY_PERFORMANCE_REPLACEMENT_FILE),
  };
};

const ensureMigrationsTable = async (pool, schemaName, tableName) => {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "${schemaName}"."${tableName}" (
      id SERIAL PRIMARY KEY,
      name varchar(255) NOT NULL,
      run_on timestamp NOT NULL
    )`
  );
};

const insertMigrationIfMissing = async (pool, schemaName, tableName, migrationName) => {
  const existing = await pool.query(
    `SELECT id, name
     FROM "${schemaName}"."${tableName}"
     WHERE name = $1
     LIMIT 1`,
    [migrationName]
  );

  if ((existing.rows || []).length > 0) {
    return false;
  }

  await pool.query(
    `INSERT INTO "${schemaName}"."${tableName}" (name, run_on)
     VALUES ($1, NOW())`,
    [migrationName]
  );

  return true;
};

const main = async () => {
  const schemaName = assertIdentifier(MIGRATIONS_SCHEMA, 'migration schema');
  const tableName = assertIdentifier(MIGRATIONS_TABLE, 'migration table');
  const pool = new Pool(resolvePgConfig());

  try {
    const tableNames = Object.keys(REQUIRED_TABLE_COLUMNS);
    const [tables, columnsByTable, indexes, applied] = await Promise.all([
      fetchTableNames(pool, 'public', tableNames),
      fetchColumns(pool, 'public', tableNames),
      fetchIndexes(pool, 'public', tableNames),
      fetchAppliedMigrations(pool, schemaName, tableName),
    ]);

    const evaluation = evaluateBaseline({ tables, columnsByTable, indexes });

    printHeader('Legacy baseline report');
    console.log(`Database: connected`);
    console.log(`Migration table: ${applied.tableExists ? `${schemaName}.${tableName}` : `${schemaName}.${tableName} (missing)`}`);
    console.log(`Replacement migration present: ${fs.existsSync(LEGACY_PERFORMANCE_REPLACEMENT_FILE) ? 'yes' : 'no'}`);

    printList('Missing tables', evaluation.missingTables);
    printList('Missing required columns', evaluation.missingColumns);
    printList('Missing initial-schema indexes', evaluation.missingInitialIndexes);
    printList('Legacy performance equivalents satisfied', evaluation.satisfiedLegacyPerformance);
    printList('Legacy performance gaps', evaluation.missingLegacyPerformance);

    const appliedNames = new Set((applied.rows || []).map((row) => row.name));
    printList(
      'Already applied migration rows',
      MIGRATIONS_TO_BASELINE.filter((name) => appliedNames.has(name))
    );

    console.log(`Initial schema baseline ready: ${evaluation.initialReady ? 'yes' : 'no'}`);
    console.log(
      `Legacy performance supersede ready: ${evaluation.initialReady && fs.existsSync(LEGACY_PERFORMANCE_REPLACEMENT_FILE) ? 'yes' : 'no'}`
    );

    if (COMMAND === 'report') {
      if (!evaluation.initialReady) {
        process.exitCode = 1;
      }
      return;
    }

    if (COMMAND !== 'apply') {
      throw new Error(`Unknown command '${COMMAND}'. Use 'report' or 'apply'.`);
    }

    if (!evaluation.initialReady) {
      throw new Error('Initial schema verification failed. Refusing to baseline legacy migrations.');
    }

    if (!INCLUDE_SUPERSEDED) {
      throw new Error(
        'Refusing to apply legacy baseline without --include-superseded-performance. Baselineing only 20240224000001 would leave the broken 20240224000002 migration pending.'
      );
    }

    if (!fs.existsSync(LEGACY_PERFORMANCE_REPLACEMENT_FILE)) {
      throw new Error(
        `Replacement migration ${LEGACY_PERFORMANCE_REPLACEMENT} is missing. Refusing to baseline superseded performance migration.`
      );
    }

    await ensureMigrationsTable(pool, schemaName, tableName);

    const inserted = [];
    for (const migrationName of MIGRATIONS_TO_BASELINE) {
      const didInsert = await insertMigrationIfMissing(pool, schemaName, tableName, migrationName);
      if (didInsert) {
        inserted.push(migrationName);
      }
    }

    printHeader('Legacy baseline apply');
    printList('Inserted migration rows', inserted);
    console.log(`Next step: npm run migrate:up`);
  } finally {
    await pool.end().catch(() => {});
  }
};

main().catch((error) => {
  console.error(`Legacy baseline failed: ${error.message}`);
  process.exit(1);
});
