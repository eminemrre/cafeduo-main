#!/usr/bin/env node
/**
 * Release gate: the whole migration history must install an empty database,
 * roll back completely and install again to the same schema.
 *
 * Only for a disposable, loopback PostgreSQL database whose name ends in
 * _test or _ci and that has no tables yet. Never point it at production:
 * 20260513000001 deletes every non-admin user.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '../..');
const RUNNER = path.join(ROOT, 'scripts/migrations/run-node-pg-migrate.js');
const MIGRATIONS_TABLE = 'pgmigrations';

const fail = (message) => {
  throw new Error(message);
};

const assertDisposable = (url) => {
  if (!url) fail('Set MIGRATION_TEST_DATABASE_URL to a disposable database.');
  if (process.env.FRESH_MIGRATION_DB_APPROVED !== '1') {
    fail('Set FRESH_MIGRATION_DB_APPROVED=1 to confirm the database is disposable.');
  }
  if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');
  const parsed = new URL(url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) {
    fail('The database must be on a loopback PostgreSQL server.');
  }
  if (!/(_test|_ci)$/.test(parsed.pathname)) fail('The database name must end in _test or _ci.');
};

const withClient = async (url, work) => {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
};

// Everything the migrations own in the public schema, in a stable order.
const snapshot = (url) =>
  withClient(url, async (client) => {
    const relations = await client.query(
      `SELECT c.relname AS name, c.relkind AS kind
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname NOT LIKE $1
        ORDER BY c.relname
        LIMIT 1000`,
      [`${MIGRATIONS_TABLE}%`]
    );
    const columns = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name <> $1
        ORDER BY table_name, column_name
        LIMIT 5000`,
      [MIGRATIONS_TABLE]
    );
    const indexes = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename <> $1
        ORDER BY indexname
        LIMIT 1000`,
      [MIGRATIONS_TABLE]
    );
    const constraints = await client.query(
      `SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
         FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> $1
        ORDER BY 1, 2
        LIMIT 1000`,
      [MIGRATIONS_TABLE]
    );
    return {
      relations: relations.rows,
      columns: columns.rows,
      indexes: indexes.rows,
      constraints: constraints.rows,
    };
  });

const migrate = (url, args) => {
  console.log(`\n=== migrate ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
  if (result.status !== 0) fail(`migrate ${args.join(' ')} failed with exit ${result.status}`);
};

const main = async () => {
  const url = process.env.MIGRATION_TEST_DATABASE_URL;
  assertDisposable(url);

  const before = await snapshot(url);
  if (before.relations.length > 0) {
    fail(`Database is not empty (${before.relations.length} relations). Use a fresh database.`);
  }

  const migrationCount = fs
    .readdirSync(path.join(ROOT, 'migrations'))
    .filter((name) => /^\d+_.*\.js$/.test(name)).length;

  migrate(url, ['up']);
  const installed = await snapshot(url);
  if (installed.relations.length === 0) fail('migrate up created no relations.');

  migrate(url, ['down', String(migrationCount)]);
  const rolledBack = await snapshot(url);
  if (rolledBack.relations.length > 0) {
    const names = rolledBack.relations.map((relation) => relation.name).join(', ');
    fail(`Full rollback left relations behind: ${names}`);
  }

  migrate(url, ['up']);
  const reinstalled = await snapshot(url);
  if (JSON.stringify(reinstalled) !== JSON.stringify(installed)) {
    fail('Schema after up → down → up differs from the first install.');
  }

  console.log(
    `\nFresh migration chain OK: ${migrationCount} migrations, ${installed.relations.length} relations, ` +
      `${installed.indexes.length} indexes, ${installed.constraints.length} constraints; up → down → up identical.`
  );
};

main().catch((error) => {
  console.error(`[verify-fresh-chain] ${error.message}`);
  process.exitCode = 1;
});
