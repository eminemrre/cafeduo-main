#!/usr/bin/env node
// Adopt an existing runtime-created schema without replaying historical data resets.
// Apply index repairs after validating the already-created bootstrap schema.
const { Pool } = require('pg');
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const apply = process.argv.includes('--apply');

function command(script, args) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${script} failed; migration adoption stopped.`);
}

async function main() {
  if (apply && !process.argv.includes('--retire-user-reset')) {
    throw new Error('Apply requires --retire-user-reset: the historical deletion is retired, not replayed.');
  }
  command('legacy-baseline.js', ['report']);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  try {
    const columns = await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,column_name LIMIT 2000");
    const available = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const column of ['cafes.table_count', 'cafes.daily_pin', 'cafes.daily_game_limit', 'cafes.daily_reward_wheel', 'games.cafe_id', 'user_items.cafe_id', 'user_daily_spins.user_id', 'user_daily_spins.cafe_id', 'user_daily_spins.spun_at']) {
      if (!available.has(column)) throw new Error(`Bootstrap schema is incomplete: ${column}`);
    }
    const indexes = await pool.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname LIMIT 2000");
    const definitions = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef]));
    for (const index of ['idx_user_daily_spins_once_per_day']) {
      if (!definitions.get(index)?.includes('UNIQUE INDEX')) throw new Error(`Required unique index missing: ${index}`);
    }
    for (const index of ['idx_games_cafe_created']) {
      if (!definitions.has(index)) throw new Error(`Required bootstrap index missing: ${index}`);
    }
    const duplicates = await pool.query("SELECT (SELECT COUNT(name)::int FROM (SELECT LOWER(username) AS name FROM users GROUP BY LOWER(username) HAVING COUNT(id)>1) names) AS usernames, (SELECT COUNT(code)::int FROM (SELECT code FROM user_items WHERE code IS NOT NULL GROUP BY code HAVING COUNT(id)>1) codes) AS coupons");
    if (duplicates.rows[0].usernames || duplicates.rows[0].coupons) throw new Error('Duplicate usernames or coupon codes require explicit data reconciliation. Adoption stopped.');
    console.log('[migration-adopt] Existing bootstrap columns and unique indexes verified.');
  } finally {
    await pool.end();
  }
  if (!apply) return;
  command('legacy-baseline.js', ['apply', '--include-superseded-performance']);
  command('run-node-pg-migrate.js', ['up', '20260306190000', '--timestamp']);
  command('run-node-pg-migrate.js', ['up', '20260430143000', '--timestamp']);
  command('run-node-pg-migrate.js', ['up', '20260513000001', '--timestamp', '--fake']);
  command('run-node-pg-migrate.js', ['up', '20260513000003', '--timestamp']);
  command('run-node-pg-migrate.js', ['up', '20260514000002', '--timestamp', '--fake']);
  command('run-node-pg-migrate.js', ['up']);
  console.log('[migration-adopt] Bootstrap history adopted; historical user reset retired without changing user data.');
  command('status.js', []);
}
main().catch((error) => {
  console.error(`[migration-adopt] ${error.message}`);
  process.exitCode = 1;
});
