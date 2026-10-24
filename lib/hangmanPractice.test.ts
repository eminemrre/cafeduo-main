/**
 * Adam Asmaca practice: a local, unranked duel against a bot.
 *
 * The practice word list is deliberately separate from the server bank
 * (`backend/gameEngine/data/words.json`); this suite keeps them apart.
 */
import {
  BOT_MISTAKE_RATE,
  PRACTICE_WORDS,
  chooseBotLetter,
  createPracticeGame,
  guessLetter,
  practiceScore,
  practiceView,
  shouldBotSolve,
  solveWord,
} from './hangmanPractice';

const serverWords = require('../backend/gameEngine/data/words.json') as { word: string }[];
const { isTurkishLetter } = require('../shared/turkishText') as {
  isTurkishLetter: (value: string) => boolean;
};

const at = (seconds: number) => 1_700_000_000_000 + seconds * 1000;

const game = () =>
  createPracticeGame({
    now: at(0),
    word: { word: 'kahve', category: 'Yiyecek ve içecek' },
  });

describe('hangmanPractice', () => {
  it('keeps its own words out of the server bank', () => {
    const bank = new Set(serverWords.map((entry) => entry.word));
    expect(PRACTICE_WORDS.length).toBeGreaterThanOrEqual(50);
    const shared = PRACTICE_WORDS.filter((entry) => bank.has(entry.word));
    expect(shared).toEqual([]);
    for (const entry of PRACTICE_WORDS) {
      expect([...entry.word].every(isTurkishLetter)).toBe(true);
      expect(entry.word.length).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(PRACTICE_WORDS.map((entry) => entry.word)).size).toBe(PRACTICE_WORDS.length);
  });

  it('opens every position of a right letter and charges a wrong one', () => {
    const first = guessLetter(game(), 'host', 'A', at(10)).game;
    const after = guessLetter(first, 'host', 'Z', at(11));
    const view = practiceView(after.game, 'host');
    expect(view.pattern).toEqual([null, 'a', null, null, null]);
    expect(view.wrong).toBe(1);
    expect(view.guessed).toEqual(['a', 'z']);
    // A board that is still open shows what it would score right now.
    expect(view.points).toBe(1);
  });

  it('refuses a letter that was already tried', () => {
    const once = guessLetter(game(), 'host', 'k', at(5));
    expect(guessLetter(once.game, 'host', 'K', at(6)).error).toBe('ALREADY_GUESSED');
  });

  it('ends a board after six wrong letters and scores the letters it revealed', () => {
    let current = game();
    for (const letter of ['k', 'a']) current = guessLetter(current, 'host', letter, at(4)).game;
    let last = current;
    for (const letter of ['b', 'c', 'd', 'f', 'g', 'ı']) {
      last = guessLetter(last, 'host', letter, at(8)).game;
    }
    expect(last.host).toMatchObject({ wrong: 6, solved: false, done: true, points: 2 });
    expect(last.phase).toBe('finished');
    expect(last.result).toMatchObject({ winner: 'host', reason: 'board_lost' });
    expect(last.host.doneAt).toBe(at(8));
  });

  it('scores a solve by lives left and time left, and a wrong word costs two lives', () => {
    const wrong = solveWord(game(), 'host', 'kahva', at(12));
    expect(wrong.game.host.wrong).toBe(2);
    expect(wrong.game.host.solved).toBe(false);
    const solved = solveWord(wrong.game, 'host', 'KAHVE', at(12));
    // 10 + 4 lives × 2 + floor(48 / 6) = 26
    expect(practiceView(solved.game, 'host')).toMatchObject({ solved: true, done: true, points: 26 });
    expect(solved.game.result?.winner).toBe('host');
    expect(practiceView(solved.game, 'guest').done).toBe(true);
  });

  it('scores an unsolved board by the letters it opened', () => {
    expect(practiceScore({ solved: false, wrong: 3, revealed: 4, secondsLeft: 20 })).toBe(4);
    expect(practiceScore({ solved: true, wrong: 1, revealed: 5, secondsLeft: 30 })).toBe(25);
  });

  it('has the bot open a letter in the word, and sometimes miss on purpose', () => {
    const empty = game();
    // random 0.9 > mistake rate → a letter of the word.
    expect(chooseBotLetter('kahve', empty.host, () => 0.9)).toBe('a');
    // random 0 → a deliberate miss.
    const miss = chooseBotLetter('kahve', empty.host, () => 0);
    expect(miss).not.toBeNull();
    expect('kahve'.includes(miss as string)).toBe(false);
    expect(BOT_MISTAKE_RATE).toBeLessThan(0.5);
  });

  it('never repeats a letter the bot already tried', () => {
    const tried = { guessed: ['a', 'e', 'k'], wrong: 0, solved: false, done: false };
    const letter = chooseBotLetter('kahve', tried as never, () => 0.9);
    expect(letter).toBe('h');
  });

  it('lets the bot guess the word once almost every letter is open', () => {
    const board = { guessed: ['k', 'a', 'h', 'v'], wrong: 0, solved: false, done: false };
    expect(shouldBotSolve('kahve', board as never, () => 0.5)).toBe(true);
    expect(shouldBotSolve('kahve', board as never, () => 0.99)).toBe(false);
    expect(shouldBotSolve('kahve', { ...board, guessed: ['k'] } as never, () => 0.5)).toBe(false);
  });
});
