/** Isolated PostgreSQL fixture, NOT a production install/migration recipe.
 * Runs the existing initial-schema and additive engine migration through
 * node-pg-migrate. Historical data resets/index repairs are intentionally not
 * replayed. A full fresh-install migration run is a separate release gate.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');

async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || process.env.GAME_ENGINE_TEST_DB_APPROVED !== '1' || process.env.NODE_ENV === 'production') {
    throw new Error('Disposable test DB approval required; production is forbidden.');
  }
  if (!/(_test|_ci)$/.test(new URL(url).pathname)) throw new Error('Database name must end in _test or _ci.');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('Disposable fixture requires a loopback PostgreSQL server.');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const exists = await client.query("SELECT to_regclass('public.users') AS users, to_regclass('public.games') AS games");
    if (exists.rows[0].users || exists.rows[0].games) throw new Error('Refusing to replace an existing app schema.');
  } finally { await client.end(); }
  fs.mkdirSync('/tmp/opencode', { recursive: true });
  const directory = fs.mkdtempSync('/tmp/opencode/game-engine-migrations-');
  const files = ['20240224000001_initial_schema.js', '20261021130000_add_game_private_state.js'];
  try {
    for (const file of files) fs.copyFileSync(path.resolve('migrations', file), path.join(directory, file));
    for (const command of ['up', 'down', 'up']) {
      const result = spawnSync(path.resolve('node_modules/.bin/node-pg-migrate'), [command, '--migrations-dir', directory], {
        env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit',
      });
      if (result.status !== 0) throw new Error(`Disposable migration ${command} failed`);
    }
  } finally {
    for (const file of files) fs.unlinkSync(path.join(directory, file));
    fs.rmdirSync(directory);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
