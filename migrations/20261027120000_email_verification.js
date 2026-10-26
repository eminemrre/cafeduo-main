/**
 * E-mail verification: when a user confirmed their address, and the one-time
 * links sent to do it (stored as sha256 hashes, like password reset tokens).
 *
 * Existing users start unverified; verification never blocks a player.
 *
 * @type {import('node-pg-migrate').Migration}
 */
exports.up = (pgm) => {
  pgm.addColumn('users', {
    email_verified_at: { type: 'timestamptz', notNull: false, default: null },
  });

  pgm.createTable('email_verification_tokens', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users', onDelete: 'CASCADE' },
    token_hash: { type: 'varchar(64)', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    used_at: { type: 'timestamptz', notNull: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('email_verification_tokens', ['user_id', 'used_at'], {
    name: 'idx_email_verification_user',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('email_verification_tokens');
  pgm.dropColumn('users', 'email_verified_at');
};
