/** @jest-environment node */

describe('securityConfig helpers', () => {
  const originalEnv = { ...process.env };

  const loadModule = () => {
    jest.resetModules();
    return require('./securityConfig');
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.JWT_SECRET;
    delete process.env.BLACKLIST_FAIL_MODE;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when JWT_SECRET is missing', () => {
    const { getRequiredJwtSecret } = loadModule();
    expect(() => getRequiredJwtSecret()).toThrow(/JWT_SECRET is required/i);
  });

  it('allows short JWT secrets outside production', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'short-test-secret';

    const { getRequiredJwtSecret } = loadModule();
    expect(getRequiredJwtSecret()).toBe('short-test-secret');
  });

  it('rejects short JWT secrets in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short-prod-secret';

    const { getRequiredJwtSecret } = loadModule();
    expect(() => getRequiredJwtSecret()).toThrow(/at least 64 characters long in production/i);
  });

  it('normalizes blacklist fail mode to closed by default', () => {
    const { getBlacklistFailMode } = loadModule();
    expect(getBlacklistFailMode()).toBe('closed');

    process.env.BLACKLIST_FAIL_MODE = 'OPEN';
    expect(loadModule().getBlacklistFailMode()).toBe('open');

    process.env.BLACKLIST_FAIL_MODE = 'garbage';
    expect(loadModule().getBlacklistFailMode()).toBe('closed');
  });
});
