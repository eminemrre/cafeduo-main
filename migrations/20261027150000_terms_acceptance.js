/** Existing accounts remain unaccepted: never fabricate a historical consent. */
exports.up = (pgm) => {
  pgm.addColumn('users', {
    terms_version: { type: 'varchar(32)', notNull: false },
    terms_accepted_at: { type: 'timestamptz', notNull: false },
  });
};

// Development/CI rollback only. Production keeps acceptance evidence on rollback.
exports.down = (pgm) => {
  pgm.dropColumn('users', ['terms_version', 'terms_accepted_at'], { ifExists: true });
};
