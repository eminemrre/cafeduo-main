const {
  DEFAULT_ALLOWED_ORIGINS,
  LOCAL_ALLOWED_ORIGINS,
  SUPPORTED_GAME_TYPES,
  normalizeGameType,
  normalizeTableCode,
  parseAllowedOrigins,
  parseAdminEmails,
} = require('./serverConfig');

describe('serverConfig helpers', () => {
  test('normalizeGameType resolves canonical names and aliases', () => {
    expect(normalizeGameType(' tank ')).toBe('Tank Düellosu');
    expect(normalizeGameType('retro_satranc')).toBe('Retro Satranç');
    expect(normalizeGameType('bilgi yarisi')).toBe('Bilgi Yarışı');
    expect(normalizeGameType('unknown')).toBeNull();
    expect(SUPPORTED_GAME_TYPES.has('Tank Düellosu')).toBe(true);
    expect(SUPPORTED_GAME_TYPES.has('Retro Satranç')).toBe(true);
    expect(SUPPORTED_GAME_TYPES.has('Bilgi Yarışı')).toBe(true);
  });

  test('normalizeTableCode normalizes MASA-prefixed and numeric inputs', () => {
    expect(normalizeTableCode('MASA09')).toBe('MASA09');
    expect(normalizeTableCode('9')).toBe('MASA09');
    expect(normalizeTableCode(' 12 ')).toBe('MASA12');
    expect(normalizeTableCode('MASA')).toBe('MASA');
    expect(normalizeTableCode('0')).toBeNull();
    expect(normalizeTableCode('abc')).toBeNull();
  });

  test('parseAllowedOrigins keeps production strict', () => {
    const parsed = parseAllowedOrigins('https://a.com, https://b.com', 'production');
    expect(parsed).toEqual(['https://a.com', 'https://b.com']);
  });

  test('parseAllowedOrigins falls back to defaults and appends localhost in development', () => {
    const parsed = parseAllowedOrigins('', 'development');
    expect(parsed).toEqual(expect.arrayContaining(DEFAULT_ALLOWED_ORIGINS));
    expect(parsed).toEqual(expect.arrayContaining(LOCAL_ALLOWED_ORIGINS));
  });

  test('parseAllowedOrigins deduplicates values', () => {
    const parsed = parseAllowedOrigins('https://cafeduotr.com,http://localhost:3000', 'development');
    expect(parsed.filter((value) => value === 'http://localhost:3000')).toHaveLength(1);
  });

  test('parseAdminEmails normalizes and falls back', () => {
    expect(parseAdminEmails(' ADMIN@EXAMPLE.COM, test@example.com ')).toEqual([
      'admin@example.com',
      'test@example.com',
    ]);
    expect(parseAdminEmails('', ['fallback@example.com'])).toEqual(['fallback@example.com']);
  });
});
