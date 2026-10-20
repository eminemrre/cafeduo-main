describe('location check exemption', () => {
  const original = process.env.CHECKIN_LOCATION_EXEMPT_USERS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CHECKIN_LOCATION_EXEMPT_USERS;
    } else {
      process.env.CHECKIN_LOCATION_EXEMPT_USERS = original;
    }
    jest.resetModules();
  });

  const load = (value) => {
    if (value === undefined) {
      delete process.env.CHECKIN_LOCATION_EXEMPT_USERS;
    } else {
      process.env.CHECKIN_LOCATION_EXEMPT_USERS = value;
    }
    jest.resetModules();
    return require('./locationExempt');
  };

  it('exempts test102 when the variable is not set', () => {
    const { isLocationCheckExempt: check } = load(undefined);
    expect(check({ username: 'test102' })).toBe(true);
    expect(check({ username: 'emin' })).toBe(false);
  });

  it('exempts nobody when the list is set but empty', () => {
    const { isLocationCheckExempt: check } = load('');
    expect(check({ username: 'test102' })).toBe(false);
    expect(check({ username: 'emin' })).toBe(false);
  });

  it('exempts the listed usernames regardless of case and spacing', () => {
    const { isLocationCheckExempt: check } = load('test102, other.user');
    expect(check({ username: 'test102' })).toBe(true);
    expect(check({ username: 'TEST102' })).toBe(true);
    expect(check({ username: ' Test102 ' })).toBe(true);
    expect(check({ username: 'other.user' })).toBe(true);
  });

  it('leaves every other account alone', () => {
    const { isLocationCheckExempt: check } = load('test102');
    expect(check({ username: 'test1020' })).toBe(false);
    expect(check({ username: 'test10' })).toBe(false);
    expect(check({ username: 'emin' })).toBe(false);
    expect(check({})).toBe(false);
    expect(check(null)).toBe(false);
  });
});
