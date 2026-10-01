#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const main = async () => {
  if (process.env.NODE_ENV !== 'production' || process.argv.includes('--fake')) return;
  if (process.env.ALLOW_DESTRUCTIVE_USER_RESET === '1') return;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const exists = await pool.query("SELECT to_regclass('public.pgmigrations') AS name");
    const applied = exists.rows[0].name
      ? await pool.query('SELECT name FROM public.pgmigrations ORDER BY id LIMIT 10000')
      : { rows: [] };
    const names = new Set(applied.rows.map((row) => row.name));
    const pending = fs.readdirSync(path.resolve(__dirname, '../../migrations'))
      .filter((name) => name.endsWith('.js') && !names.has(name.slice(0, -3))).sort();
    const args = process.argv.slice(2);
    const number = args.find((arg) => /^\d+$/.test(arg));
    const selected = args.includes('--timestamp')
      ? pending.filter((name) => Number(name.split('_')[0]) <= Number(number))
      : pending.slice(0, number ? Number(number) : pending.length);
    if (selected.includes('20260513000001_reset_users_keep_admins.js')) {
      throw new Error('Refusing historical user reset in production. Adopt the verified bootstrap schema with migrate:adopt, or explicitly authorize ALLOW_DESTRUCTIVE_USER_RESET=1.');
    }
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(`[migration-guard] ${error.message}`);
  process.exitCode = 1;
});
