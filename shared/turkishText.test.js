/** @jest-environment node */
const { TURKISH_ALPHABET, normalizeGuess, isTurkishLetter, normalizeLetter } = require('./turkishText');

describe('turkishText', () => {
  it('has the 29 letters of the Turkish alphabet, in order', () => {
    expect(TURKISH_ALPHABET.join('')).toBe('abcçdefgğhıijklmnoöprsştuüvyz');
  });

  it('lowercases with Turkish rules: I → ı and İ → i', () => {
    expect(normalizeGuess('IŞIK')).toBe('ışık');
    expect(normalizeGuess('İstanbul')).toBe('istanbul');
    expect(normalizeGuess('  Kahve  Fincanı! ')).toBe('kahvefincanı');
  });

  it('keeps Turkish letters distinct and drops everything that is not a letter', () => {
    expect(normalizeGuess('çağ-dış 1')).toBe('çağdış');
    expect(normalizeGuess('cag')).not.toBe(normalizeGuess('çağ'));
    expect(normalizeGuess(42)).toBe('');
    expect(normalizeGuess(null)).toBe('');
  });

  it('accepts exactly one Turkish letter as a hangman guess', () => {
    expect(normalizeLetter('Ş')).toBe('ş');
    expect(normalizeLetter('I')).toBe('ı');
    expect(normalizeLetter('i')).toBe('i');
    for (const bad of ['q', 'w', 'x', 'ab', '', ' ', '1', null, 7]) {
      expect(normalizeLetter(bad)).toBeNull();
    }
    expect(isTurkishLetter('ğ')).toBe(true);
    expect(isTurkishLetter('q')).toBe(false);
  });
});
