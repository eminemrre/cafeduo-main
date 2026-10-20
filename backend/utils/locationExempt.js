/**
 * Location check exemption.
 *
 * Check-in proves the player is really in the café: either the device's
 * position is inside the café's radius, or the table's verification code is
 * entered. A few accounts (test accounts, staff devices without GPS) cannot
 * use either and are listed here by username.
 *
 * The list is read from the environment so it can be changed without a code
 * change: `CHECKIN_LOCATION_EXEMPT_USERS=test102,other.user` (comma separated,
 * case-insensitive). When the variable is not set at all the built-in default
 * applies, so the exemption does not depend on the host passing it through;
 * set it to an empty string to exempt nobody.
 */
const DEFAULT_EXEMPT_USERS = 'test102';
const parseUsernames = (raw) =>
  new Set(
    String(raw || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

const exemptUsernames = parseUsernames(
  process.env.CHECKIN_LOCATION_EXEMPT_USERS ?? DEFAULT_EXEMPT_USERS
);

/** True when this account skips the café's location (geofence) verification. */
const isLocationCheckExempt = (user) => {
  if (!user || exemptUsernames.size === 0) return false;
  const username = String(user.username || '')
    .trim()
    .toLowerCase();
  if (!username) return false;
  return exemptUsernames.has(username);
};

module.exports = { isLocationCheckExempt, exemptUsernames };
