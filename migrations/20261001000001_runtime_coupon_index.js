exports.up = (pgm) => {
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_user_items_cafe_code ON user_items (cafe_id, code);');
};

exports.down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_user_items_cafe_code;');
};
