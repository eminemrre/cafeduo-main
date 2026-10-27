/**
 * E-mail verification links: issue one (closing older ones), confirm it once.
 *
 * Tokens are 32 random bytes sent in the link and stored only as a sha256
 * hash, valid for 24 hours, single use. Confirming is idempotent: the user
 * row is updated only while unverified, so two clicks at once verify once and
 * the welcome e-mail leaves once. A newer link supersedes older ones (they
 * answer "expired", which offers a resend). Without a database the same rules
 * run on the memory users.
 *
 * Sending never throws to the caller; a failed send is logged.
 */

const { createHash, randomBytes } = require('crypto');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const hashToken = (raw) => createHash('sha256').update(String(raw)).digest('hex');

const createEmailVerificationService = ({
  pool,
  isDbConnected,
  getMemoryUsers,
  sendEmail,
  logger,
  now = Date.now,
  appUrl,
}) => {
  /** Memory mode: { userId, tokenHash, expiresAt, usedAt } */
  const memoryTokens = [];
  const baseUrl = () => String(typeof appUrl === 'function' ? appUrl() : appUrl).replace(/\/+$/, '');

  /** Resolves `{ delivered }`; never throws (a failure is logged). */
  const send = (args, failure, meta) =>
    Promise.resolve()
      .then(() => sendEmail(args))
      .then((result) => ({ delivered: Boolean(result?.delivered) }))
      .catch((error) => {
        logger.error(failure, { ...meta, error: error?.message || String(error) });
        return { delivered: false };
      });

  const issueVerification = async (user) => {
    const raw = randomBytes(32).toString('hex');
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(now() + VERIFICATION_TTL_MS);
    if (await isDbConnected()) {
      // One statement: the new link exists before older ones close, and a
      // failure leaves the user's current link valid.
      await pool.query(
        `WITH inserted AS (
           INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)
           RETURNING id
         )
         UPDATE email_verification_tokens SET used_at = $4
         WHERE user_id = $1 AND used_at IS NULL AND id <> (SELECT id FROM inserted)`,
        [user.id, tokenHash, expiresAt, new Date(now())]
      );
    } else {
      for (const token of memoryTokens) {
        if (token.userId === user.id && !token.usedAt) token.usedAt = now();
      }
      memoryTokens.push({ userId: user.id, tokenHash, expiresAt: expiresAt.getTime(), usedAt: null });
    }
    return send(
      {
        to: user.email,
        template: 'verify_email',
        data: {
          username: user.username,
          verifyUrl: `${baseUrl()}/dogrula?token=${raw}`,
          expiresInHours: VERIFICATION_TTL_MS / 3_600_000,
        },
        idempotencyKey: `verify_email/${user.id}/${tokenHash.slice(0, 16)}`,
      },
      'Verification e-mail send failed',
      { userId: user.id }
    );
  };

  /** Fire and forget: the verification answer never waits for the welcome e-mail. */
  const welcome = (user) =>
    void send(
      {
        to: user.email,
        template: 'welcome',
        data: { username: user.username, appUrl: baseUrl() },
        idempotencyKey: `welcome/${user.id}`,
      },
      'Welcome e-mail send failed',
      { userId: user.id }
    );

  const confirmVerification = async (rawToken) => {
    const raw = String(rawToken || '').trim().toLowerCase();
    if (!TOKEN_PATTERN.test(raw)) return { status: 'invalid' };
    const tokenHash = hashToken(raw);
    const at = now();

    if (await isDbConnected()) {
      const { rows } = await pool.query(
        `SELECT t.id, t.user_id, t.expires_at, t.used_at, u.email, u.username, u.email_verified_at
         FROM email_verification_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = $1
         LIMIT 1`,
        [tokenHash]
      );
      const row = rows[0];
      if (!row) return { status: 'invalid' };
      const userId = row.user_id;
      if (row.email_verified_at) return { status: 'already', userId };
      if (row.used_at || Date.parse(row.expires_at) <= at) return { status: 'expired', userId };
      const updated = await pool.query(
        'UPDATE users SET email_verified_at = $2 WHERE id = $1 AND email_verified_at IS NULL',
        [userId, new Date(at)]
      );
      await pool.query('UPDATE email_verification_tokens SET used_at = $2 WHERE id = $1', [
        row.id,
        new Date(at),
      ]);
      if (!updated.rowCount) return { status: 'already', userId };
      welcome({ id: userId, email: row.email, username: row.username });
      return { status: 'verified', userId };
    }

    const token = memoryTokens.find((entry) => entry.tokenHash === tokenHash);
    if (!token) return { status: 'invalid' };
    const user = getMemoryUsers().find((entry) => Number(entry.id) === Number(token.userId));
    if (!user) return { status: 'invalid' };
    const userId = token.userId;
    if (user.emailVerifiedAt) return { status: 'already', userId };
    if (token.usedAt || token.expiresAt <= at) return { status: 'expired', userId };
    user.emailVerifiedAt = new Date(at).toISOString();
    token.usedAt = at;
    welcome(user);
    return { status: 'verified', userId };
  };

  return { issueVerification, confirmVerification };
};

/** The app-wide instance. */
const buildDefault = () => {
  const { pool, isDbConnected } = require('../db');
  const memoryState = require('../store/memoryState');
  const { sendEmail } = require('./emailService');
  const logger = require('../utils/logger');
  const { resolveAppBaseUrl } = require('../utils/appUrl');
  return createEmailVerificationService({
    pool,
    isDbConnected,
    getMemoryUsers: () => (Array.isArray(memoryState.users) ? memoryState.users : []),
    sendEmail,
    logger,
    appUrl: resolveAppBaseUrl,
  });
};

let instance = null;
const emailVerification = () => {
  if (!instance) instance = buildDefault();
  return instance;
};

module.exports = { VERIFICATION_TTL_MS, createEmailVerificationService, emailVerification };
