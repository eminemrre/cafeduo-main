/**
 * Turkish letters and guess normalisation, shared by the server engines
 * (Adam Asmaca, Çiz Bil) and the client keyboard so both compare the same way.
 *
 * Lowercasing must follow Turkish rules (I → ı, İ → i); `toLocaleLowerCase`
 * with the `tr-TR` locale does that, plain `toLowerCase` does not.
 *
 * Loaded by both runtimes like `battleship.js`: CommonJS for the backend, a
 * private global for Vite (`lib/turkishText.ts`).
 */
(function publishTurkishText(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.__CAFEDUO_TURKISH_TEXT__ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createTurkishText() {
  const TURKISH_ALPHABET = Object.freeze([...'abcçdefgğhıijklmnoöprsştuüvyz']);
  const LETTERS = new Set(TURKISH_ALPHABET);

  const lower = (value) =>
    String(value)
      .replace(/I/g, 'ı')
      .replace(/İ/g, 'i')
      .toLocaleLowerCase('tr-TR');

  const isTurkishLetter = (value) => typeof value === 'string' && LETTERS.has(value);

  /** Lowercase Turkish letters only; spaces, punctuation and digits are dropped. */
  const normalizeGuess = (value) => {
    if (typeof value !== 'string') return '';
    return [...lower(value)].filter(isTurkishLetter).join('');
  };

  /** One Turkish letter (any case), or null. */
  const normalizeLetter = (value) => {
    if (typeof value !== 'string') return null;
    const letters = [...lower(value.trim())];
    return letters.length === 1 && isTurkishLetter(letters[0]) ? letters[0] : null;
  };

  return { TURKISH_ALPHABET, isTurkishLetter, normalizeGuess, normalizeLetter };
});
