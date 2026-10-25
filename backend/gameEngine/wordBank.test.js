/** @jest-environment node */
/**
 * The ranked word bank is not in the repository (it is public): production
 * reads it from WORD_BANK_PATH and fails closed without it; development and
 * tests use the small fixture, whose words are not in the real bank.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CATEGORIES, loadWordBank, validateWordBank } = require('./wordBank');
const fixture = require('./data/words.fixture.json');

const tmpFile = (content) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wordbank-'));
  const file = path.join(dir, 'words.json');
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
};
const logger = () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn() });

describe('validateWordBank', () => {
  it('accepts the fixture as a playable bank', () => {
    expect(validateWordBank(fixture)).toEqual({ ok: true, errors: [] });
  });

  it('names every broken entry', () => {
    const { ok, errors } = validateWordBank([
      ...fixture,
      { word: 'bowling', category: 'Spor ve oyun', difficulty: 2 },
      { word: 'dut', category: 'Yiyecek ve içecek', difficulty: 1 },
      { word: 'ab', category: 'Hayvanlar', difficulty: 1 },
      { word: 'kedi', category: 'Uzay', difficulty: 1 },
      { word: 'kedi', category: 'Hayvanlar', difficulty: 4 },
      { word: 'kedi', category: 'Hayvanlar', difficulty: 1, extra: true },
    ]);
    expect(ok).toBe(false);
    expect(errors.join('\n')).toMatch(/bowling/);
    expect(errors.join('\n')).toMatch(/repeated.*dut/);
    expect(errors.join('\n')).toMatch(/"ab"/);
    expect(errors.join('\n')).toMatch(/Uzay/);
    expect(errors.join('\n')).toMatch(/difficulty/);
    expect(errors.join('\n')).toMatch(/keys/);
  });

  it('accepts an optional drawable flag and needs enough drawable words for Çiz Bil', () => {
    expect(validateWordBank([...fixture, { word: 'özlem', category: 'Hayvanlar', difficulty: 1, drawable: false }]).ok).toBe(true);
    expect(validateWordBank([...fixture, { word: 'özlem', category: 'Hayvanlar', difficulty: 1, drawable: 'no' }]).ok).toBe(false);
    const abstract = fixture.map((entry) => (entry.difficulty === 2 ? { ...entry, drawable: false } : entry));
    expect(validateWordBank(abstract).errors.join('\n')).toMatch(/difficulty 2 needs at least 4 drawable/);
  });

  it('needs three categories at every difficulty so a match can be drawn', () => {
    const thin = fixture.filter(
      (entry) =>
        entry.difficulty !== 3 ||
        ['Hayvanlar', 'Ulaşım'].includes(entry.category)
    );
    expect(validateWordBank(thin)).toMatchObject({ ok: false });
    expect(validateWordBank(thin).errors.join('\n')).toMatch(/difficulty 3/);
  });

  it('holds the real bank to the full size in strict mode', () => {
    expect(validateWordBank(fixture, { strict: true }).ok).toBe(false);
  });

  it('refuses something that is not a list', () => {
    expect(validateWordBank({ word: 'kedi' }).ok).toBe(false);
    expect(validateWordBank(null).ok).toBe(false);
  });
});

describe('loadWordBank', () => {
  it('uses the fixture outside production when no path is set', () => {
    const bank = loadWordBank({ env: { NODE_ENV: 'test' }, logger: logger() });
    expect(bank).toMatchObject({ ready: true, source: 'fixture' });
    expect(bank.words).toHaveLength(fixture.length);
  });

  it('is unavailable in production without a path, and never falls back to the fixture', () => {
    const log = logger();
    const bank = loadWordBank({ env: { NODE_ENV: 'production' }, logger: log });
    expect(bank).toEqual({ ready: false, source: null, words: null });
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/WORD_BANK_PATH/));
  });

  it('reads a valid file from WORD_BANK_PATH and checks it strictly in production', () => {
    const file = tmpFile(fixture);
    expect(loadWordBank({ env: { NODE_ENV: 'test', WORD_BANK_PATH: file }, logger: logger() })).toMatchObject({
      ready: true,
      source: 'file',
    });
    // The fixture is far smaller than the real bank: production refuses it.
    const log = logger();
    expect(loadWordBank({ env: { NODE_ENV: 'production', WORD_BANK_PATH: file }, logger: log })).toMatchObject({
      ready: false,
    });
    expect(log.error).toHaveBeenCalled();
  });

  it('fails closed on a missing, empty or broken file without logging its words', () => {
    for (const file of ['/nonexistent/words.json', tmpFile(''), tmpFile('{not json'), tmpFile([{ word: 1 }])]) {
      const log = logger();
      const bank = loadWordBank({ env: { NODE_ENV: 'test', WORD_BANK_PATH: file }, logger: log });
      expect(bank).toEqual({ ready: false, source: null, words: null });
      expect(JSON.stringify(log.error.mock.calls)).not.toMatch(/dut|ceylan/);
    }
  });

  it('knows the ten categories', () => {
    expect(CATEGORIES).toHaveLength(10);
  });
});

// The real bank lives outside the repository; check it whenever it is present.
const realPath = process.env.WORD_BANK_PATH;
(realPath ? describe : describe.skip)('real word bank (WORD_BANK_PATH)', () => {
  it('passes the strict checks and shares no word with the fixture', () => {
    const words = JSON.parse(fs.readFileSync(realPath, 'utf8'));
    expect(validateWordBank(words, { strict: true })).toEqual({ ok: true, errors: [] });
    const real = new Set(words.map((entry) => entry.word));
    expect(fixture.filter((entry) => real.has(entry.word))).toEqual([]);
  });
});
