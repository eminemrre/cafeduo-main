/**
 * Tag every redeemed coupon with the cafe it was bought at.
 *
 * Until now user_items.cafe_id didn't exist — coupons floated free of
 * any cafe association. That meant cafe-admin A could scan a coupon
 * minted at cafe B and the validator would accept it (the useCoupon
 * query only checked `code`, no `cafe_id` filter). This migration adds
 * the column and a composite index so the validator can cheaply
 * filter by cafe.
 *
 * Existing rows get NULL — they were redeemed before the cafe-aware
 * flow existed and we have no historical record of which cafe they
 * belong to. The new useCoupon path treats NULL as "wildcard" (any
 * cafe-admin can still redeem legacy codes) so we don't break old
 * coupons retroactively; future inserts must populate cafe_id.
 */
exports.up = (pgm) => {
  pgm.addColumn('user_items', {
    cafe_id: {
      type: 'INTEGER',
      references: 'cafes(id)',
      onDelete: 'SET NULL',
    },
  });

  // Composite index — useCoupon filters `WHERE code = $1 AND cafe_id = $2`,
  // so (cafe_id, code) lets pg jump straight to the row instead of falling
  // back to the unique(code) index + filter.
  pgm.createIndex('user_items', ['cafe_id', 'code'], {
    name: 'idx_user_items_cafe_code',
  });
};

exports.down = (pgm) => {
  // 20261001000001 adopts this index with IF NOT EXISTS and drops it on its
  // own rollback, so it may already be gone here.
  pgm.dropIndex('user_items', ['cafe_id', 'code'], {
    name: 'idx_user_items_cafe_code',
    ifExists: true,
  });
  pgm.dropColumn('user_items', 'cafe_id');
};
