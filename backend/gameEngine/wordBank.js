/**
 * The ranked word bank of Adam Asmaca (and later Çiz Bil).
 *
 * The repository is public, and the public round state names the word's
 * length and category, so a published bank would let a script solve before
 * the first letter. The real bank therefore never enters the repository:
 * production reads it from WORD_BANK_PATH (written by the deploy from a
 * GitHub secret) and fails closed without a valid one. Development and tests
 * use `data/words.fixture.json`, whose words are not in the real bank.
 *
 * Errors name the problem, never a word of the bank.
 */

const fs = require('fs');
const path = require('path');
const { isTurkishLetter } = require('../../shared/turkishText');

const CATEGORIES = Object.freeze([
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
]);
const DIFFICULTIES = Object.freeze([1, 2, 3]);
const ENTRY_KEYS = 'category,difficulty,word';
const MIN_LETTERS = 3;
const MAX_LETTERS = 12;
/** A match takes one word per difficulty, each from a different category. */
const MIN_CATEGORIES_PER_DIFFICULTY = 3;
/** The real bank: size and balance agreed for ranked play. */
const STRICT = Object.freeze({ total: 600, perCategory: 55, perCell: 12 });
const FIXTURE_PATH = path.join(__dirname, 'data', 'words.fixture.json');

const validateWordBank = (words, { strict = false } = {}) => {
  if (!Array.isArray(words)) return { ok: false, errors: ['the bank is not a list'] };
  const errors = [];
  const seen = new Set();
  words.forEach((entry, index) => {
    const at = `entry ${index}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${at}: not an object`);
      return;
    }
    if (Object.keys(entry).sort().join(',') !== ENTRY_KEYS) {
      errors.push(`${at}: keys must be word, category, difficulty`);
    }
    const { word, category, difficulty } = entry;
    if (
      typeof word !== 'string' ||
      word.length < MIN_LETTERS ||
      word.length > MAX_LETTERS ||
      ![...word].every(isTurkishLetter)
    ) {
      errors.push(`${at}: ${JSON.stringify(word)} is not ${MIN_LETTERS}-${MAX_LETTERS} lowercase Turkish letters`);
    } else if (seen.has(word)) {
      errors.push(`${at}: repeated word ${JSON.stringify(word)}`);
    } else {
      seen.add(word);
    }
    if (!CATEGORIES.includes(category)) errors.push(`${at}: unknown category ${JSON.stringify(category)}`);
    if (!DIFFICULTIES.includes(difficulty)) errors.push(`${at}: difficulty must be 1, 2 or 3`);
  });

  for (const difficulty of DIFFICULTIES) {
    const categories = new Set(
      words.filter((entry) => entry?.difficulty === difficulty).map((entry) => entry?.category)
    );
    if (categories.size < MIN_CATEGORIES_PER_DIFFICULTY) {
      errors.push(`difficulty ${difficulty} needs words in at least ${MIN_CATEGORIES_PER_DIFFICULTY} categories`);
    }
  }

  if (strict) {
    if (words.length < STRICT.total) errors.push(`strict: fewer than ${STRICT.total} words`);
    for (const category of CATEGORIES) {
      const inCategory = words.filter((entry) => entry?.category === category);
      if (inCategory.length < STRICT.perCategory) {
        errors.push(`strict: ${category} has fewer than ${STRICT.perCategory} words`);
      }
      for (const difficulty of DIFFICULTIES) {
        if (inCategory.filter((entry) => entry.difficulty === difficulty).length < STRICT.perCell) {
          errors.push(`strict: ${category} / difficulty ${difficulty} has fewer than ${STRICT.perCell} words`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
};

const UNAVAILABLE = Object.freeze({ ready: false, source: null, words: null });

/**
 * Loads the bank once: WORD_BANK_PATH if set (strictly checked in
 * production), else the fixture outside production, else unavailable.
 */
const loadWordBank = ({ env = process.env, logger = require('../utils/logger') } = {}) => {
  const production = env.NODE_ENV === 'production';
  const file = String(env.WORD_BANK_PATH || '').trim();
  if (!file) {
    if (production) {
      logger.error('Word bank unavailable: WORD_BANK_PATH is not set; Adam Asmaca stays closed');
      return UNAVAILABLE;
    }
    return { ready: true, source: 'fixture', words: Object.freeze(require(FIXTURE_PATH)) };
  }
  let words;
  try {
    words = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    logger.error('Word bank unavailable: WORD_BANK_PATH could not be read as JSON', {
      code: error?.code || error?.name,
    });
    return UNAVAILABLE;
  }
  const { ok, errors } = validateWordBank(words, { strict: production });
  if (!ok) {
    logger.error('Word bank unavailable: WORD_BANK_PATH failed validation', {
      errors: errors.slice(0, 5).map((message) => message.replace(/"[^"]*"/g, '"…"')),
      count: errors.length,
    });
    return UNAVAILABLE;
  }
  return { ready: true, source: 'file', words: Object.freeze(words) };
};

let cached = null;
const getWordBank = () => {
  if (!cached) cached = loadWordBank();
  return cached;
};
const isWordBankReady = () => getWordBank().ready;

module.exports = {
  CATEGORIES,
  getWordBank,
  isWordBankReady,
  loadWordBank,
  validateWordBank,
};
