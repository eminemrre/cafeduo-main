/**
 * Enforce UNIQUE constraint on user_items.code.
 *
 * Each coupon redemption should produce a per-user, per-purchase unique
 * code (a `CD-XXXXXXXXXXXX` random string). Without a DB-level guard, a
 * collision in the random generator OR a duplicate INSERT from a bug
 * could silently let two users hold the same code — the cafe-admin
 * scanner endpoint (commerceHandlers.useCoupon) would then redeem
 * whichever row UPDATE happened to match first.
 *
 * Two things this migration does:
 *   1. Removes legacy duplicate codes (left over from the old
 *      storeController hardcoded per-item codes). We keep the
 *      earliest-redeemed copy and orphan the rest by suffixing
 *      `-LEGACY-<id>` so the UNIQUE INDEX creation doesn't fail.
 *   2. Adds the UNIQUE INDEX so future INSERTs cannot collide.
 *
 * Idempotent: re-running the migration is safe.
 */
exports.up = (pgm) => {
  pgm.sql(`
    -- 1. Suffix legacy duplicates so the unique index can be created
    WITH duplicates AS (
      SELECT id,
             code,
             ROW_NUMBER() OVER (PARTITION BY code ORDER BY redeemed_at ASC, id ASC) AS rn
      FROM user_items
      WHERE code IS NOT NULL
    )
    UPDATE user_items ui
       SET code = ui.code || '-LEGACY-' || ui.id
      FROM duplicates d
     WHERE ui.id = d.id
       AND d.rn > 1;

    -- 2. Enforce uniqueness from now on
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_items_code_unique
      ON user_items (code);
  `);
};

exports.down = (pgm) => {
  // Drop the constraint but do not attempt to restore the legacy
  // suffixed codes — restore from backup if needed.
  pgm.sql(`DROP INDEX IF EXISTS idx_user_items_code_unique;`);
};
