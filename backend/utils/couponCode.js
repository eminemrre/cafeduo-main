// eslint-disable-next-line no-redeclare
const crypto = require('crypto');

/**
 * Build a per-redemption unique coupon code. 12 hex chars in three groups
 * of 4 (CD-XXXX-XXXX-XXXX) — short enough to read aloud at the cashier if
 * the QR fails, long enough to make accidental collisions astronomically
 * unlikely (48 bits of entropy).
 *
 * One generator for the store, the daily wheel and tournament prizes, so the
 * cafe-admin scanner validates every path with the same format.
 */
const generateCouponCode = () => {
  const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `CD-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
};

module.exports = { generateCouponCode };
