/**
 * Normalize legacy performance indexes after baselineing pre-migration production databases.
 *
 * Background:
 * - Production was historically bootstrapped via schema.sql / initDb, not node-pg-migrate.
 * - 20240224000002_add_performance_indexes.js was never recorded in pgmigrations on production.
 * - That legacy migration also references password_reset_tokens.token, but the real schema uses token_hash.
 *
 * This migration backfills only the missing, valid performance indexes that are still useful on the
 * runtime schema. Duplicate-equivalent indexes already created by schema.sql/initDb are intentionally
 * not recreated under new names.
 *
 * @type {import('node-pg-migrate').Migration}
 */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_games_status_created
      ON games (status, created_at DESC)
      WHERE status = 'waiting';
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_games_status_table_created
      ON games (status, table_code, created_at DESC)
      WHERE status = 'waiting';
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_games_status_type_created
      ON games (status, game_type, created_at DESC)
      WHERE status = 'waiting';
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_games_host_status_created
      ON games (host_name, status, created_at DESC)
      WHERE status IN ('waiting', 'active');
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_games_guest_status_created
      ON games (guest_name, status, created_at DESC)
      WHERE status IN ('waiting', 'active') AND guest_name IS NOT NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_users_cafe_table
      ON users (cafe_id, table_number)
      WHERE cafe_id IS NOT NULL;
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_users_points_desc
      ON users (points DESC);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_users_cafe_active
      ON users (cafe_id)
      WHERE cafe_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_users_cafe_active;');
  pgm.sql('DROP INDEX IF EXISTS idx_users_points_desc;');
  pgm.sql('DROP INDEX IF EXISTS idx_users_cafe_table;');
  pgm.sql('DROP INDEX IF EXISTS idx_games_guest_status_created;');
  pgm.sql('DROP INDEX IF EXISTS idx_games_host_status_created;');
  pgm.sql('DROP INDEX IF EXISTS idx_games_status_type_created;');
  pgm.sql('DROP INDEX IF EXISTS idx_games_status_table_created;');
  pgm.sql('DROP INDEX IF EXISTS idx_games_status_created;');
};
