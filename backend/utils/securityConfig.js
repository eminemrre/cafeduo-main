const MIN_JWT_SECRET_LENGTH = 64;

const isProductionEnv = () => String(process.env.NODE_ENV || '').trim() === 'production';

const getRequiredJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '');

  if (!secret) {
    throw new Error('JWT_SECRET is required. Refusing to start with an insecure fallback secret.');
  }

  if (isProductionEnv() && secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long in production. Refusing to start.`
    );
  }

  return secret;
};

const getBlacklistFailMode = () => {
  const rawMode = String(process.env.BLACKLIST_FAIL_MODE || 'closed').trim().toLowerCase();
  return rawMode === 'open' ? 'open' : 'closed';
};

module.exports = {
  MIN_JWT_SECRET_LENGTH,
  getBlacklistFailMode,
  getRequiredJwtSecret,
  isProductionEnv,
};
