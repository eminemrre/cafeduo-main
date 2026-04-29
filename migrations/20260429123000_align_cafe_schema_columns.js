/**
 * Align legacy initDb cafe columns with migration-created cafe columns.
 *
 * Some deployments were first created by backend/server.js initDb and have
 * table_count/daily_pin, while migration-created databases have
 * total_tables/pin/address. Admin cafe workflows need both naming sets.
 *
 * @type {import('node-pg-migrate').Migration}
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE cafes
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS total_tables INTEGER DEFAULT 10,
      ADD COLUMN IF NOT EXISTS pin VARCHAR(4) DEFAULT '0000',
      ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 20,
      ADD COLUMN IF NOT EXISTS daily_pin VARCHAR(6) DEFAULT '0000';
  `);

  pgm.sql(`
    UPDATE cafes
    SET
      table_count = COALESCE(table_count, total_tables, 20),
      total_tables = COALESCE(total_tables, table_count, 20),
      pin = COALESCE(NULLIF(pin, ''), SUBSTRING(NULLIF(daily_pin, '') FROM 1 FOR 4), '0000'),
      daily_pin = COALESCE(NULLIF(daily_pin, ''), NULLIF(pin, ''), '0000');
  `);
};

exports.down = () => {
  // No-op: these compatibility columns may predate this migration on legacy databases.
};
