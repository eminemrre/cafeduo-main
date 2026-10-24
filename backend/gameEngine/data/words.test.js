/** @jest-environment node */
/**
 * The shared word bank for Adam Asmaca and Çiz Bil. It lives on the server
 * only; the client never imports it (see the build check in CI).
 */
const words = require('./words.json');
const { isTurkishLetter } = require('../../../shared/turkishText');

const CATEGORIES = [
  'Yiyecek ve içecek',
  'Hayvanlar',
  'Ev ve eşyalar',
  'Meslekler',
  'Spor ve oyun',
  'Doğa ve hava',
  'Ulaşım',
  'Okul ve kampüs',
  'Müzik ve sanat',
  'Şehir hayatı',
];

describe('word bank', () => {
  it('has the agreed shape', () => {
    expect(Array.isArray(words)).toBe(true);
    for (const entry of words) {
      expect(Object.keys(entry).sort()).toEqual(['category', 'difficulty', 'word']);
      expect(CATEGORIES).toContain(entry.category);
      expect([1, 2, 3]).toContain(entry.difficulty);
    }
  });

  it('holds single lowercase Turkish words of 3 to 12 letters', () => {
    const bad = words.filter(
      ({ word }) =>
        typeof word !== 'string' ||
        word.length < 3 ||
        word.length > 12 ||
        ![...word].every(isTurkishLetter)
    );
    expect(bad).toEqual([]);
  });

  it('never repeats a word', () => {
    const seen = new Map();
    const repeats = [];
    for (const { word } of words) {
      if (seen.has(word)) repeats.push(word);
      seen.set(word, true);
    }
    expect(repeats).toEqual([]);
  });

  it('fills every category at every difficulty', () => {
    expect(words.length).toBeGreaterThanOrEqual(600);
    for (const category of CATEGORIES) {
      const inCategory = words.filter((entry) => entry.category === category);
      expect({ category, count: inCategory.length }).toEqual({
        category,
        count: expect.any(Number),
      });
      expect(inCategory.length).toBeGreaterThanOrEqual(55);
      for (const difficulty of [1, 2, 3]) {
        const count = inCategory.filter((entry) => entry.difficulty === difficulty).length;
        expect({ category, difficulty, enough: count >= 12 }).toEqual({
          category,
          difficulty,
          enough: true,
        });
      }
    }
  });
});
