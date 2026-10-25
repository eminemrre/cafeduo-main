/**
 * Adam Asmaca practice: a local, unranked duel against a bot.
 *
 * The ranked match runs on the server engine; this module mirrors its rules
 * (60 s, six lives, a wrong whole-word guess costs two lives, points from
 * lives and time left) for the `BOT` opponent only. It never sends anything
 * and never awards points.
 *
 * Its word list is deliberately separate from the server bank: the client
 * must not ship the ranked words. `hangmanPractice.test.ts` keeps the two
 * lists apart.
 */

import { normalizeGuess, normalizeLetter } from './turkishText';

export interface PracticeBoard {
  /** Letters tried, in order, normalised to lowercase Turkish letters. */
  guessed: string[];
  wrong: number;
  solved: boolean;
  done: boolean;
  doneAt: number | null;
  points: number;
}

export interface PracticeGame {
  word: string;
  category: string;
  length: number;
  startedAt: number;
  endsAt: number;
  host: PracticeBoard;
  guest: PracticeBoard;
  phase: 'open' | 'finished';
  result: { winner: 'host' | 'guest' | null; reason: string } | null;
}

export type PracticeError = 'BOARD_DONE' | 'ALREADY_GUESSED' | 'INVALID_LETTER';

export interface PracticeResult {
  game: PracticeGame;
  error: PracticeError | null;
}

export interface PracticeView {
  pattern: (string | null)[];
  guessed: string[];
  wrong: number;
  solved: boolean;
  done: boolean;
  points: number;
}

export const PRACTICE_ROUND_MS = 60_000;
export const PRACTICE_MAX_WRONG = 6;
export const PRACTICE_SOLVE_PENALTY = 2;
export const BOT_MISTAKE_RATE = 0.18;
export const BOT_SOLVE_CHANCE = 0.8;

/** English-free, concrete Turkish words, none of them in the server bank. */
export const PRACTICE_WORDS: { word: string; category: string }[] = [
  { word: 'badem', category: 'Yiyecek ve içecek' },
  { word: 'ceviz', category: 'Yiyecek ve içecek' },
  { word: 'fındık', category: 'Yiyecek ve içecek' },
  { word: 'kayısı', category: 'Yiyecek ve içecek' },
  { word: 'vişne', category: 'Yiyecek ve içecek' },
  { word: 'helva', category: 'Yiyecek ve içecek' },
  { word: 'zencefil', category: 'Yiyecek ve içecek' },
  { word: 'tarçın', category: 'Yiyecek ve içecek' },
  { word: 'maydanoz', category: 'Yiyecek ve içecek' },
  { word: 'mercimek', category: 'Yiyecek ve içecek' },
  { word: 'sırtlan', category: 'Hayvanlar' },
  { word: 'çakal', category: 'Hayvanlar' },
  { word: 'karaca', category: 'Hayvanlar' },
  { word: 'şahin', category: 'Hayvanlar' },
  { word: 'kırlangıç', category: 'Hayvanlar' },
  { word: 'güvercin', category: 'Hayvanlar' },
  { word: 'horoz', category: 'Hayvanlar' },
  { word: 'kuğu', category: 'Hayvanlar' },
  { word: 'pelikan', category: 'Hayvanlar' },
  { word: 'martı', category: 'Hayvanlar' },
  { word: 'sürahi', category: 'Ev ve eşyalar' },
  { word: 'maşrapa', category: 'Ev ve eşyalar' },
  { word: 'bakraç', category: 'Ev ve eşyalar' },
  { word: 'küvet', category: 'Ev ve eşyalar' },
  { word: 'lavabo', category: 'Ev ve eşyalar' },
  { word: 'musluk', category: 'Ev ve eşyalar' },
  { word: 'balkon', category: 'Ev ve eşyalar' },
  { word: 'baca', category: 'Ev ve eşyalar' },
  { word: 'menteşe', category: 'Ev ve eşyalar' },
  { word: 'tutamak', category: 'Ev ve eşyalar' },
  { word: 'kaynakçı', category: 'Meslekler' },
  { word: 'çömlekçi', category: 'Meslekler' },
  { word: 'demirci', category: 'Meslekler' },
  { word: 'nalbur', category: 'Meslekler' },
  { word: 'manav', category: 'Meslekler' },
  { word: 'kasiyer', category: 'Meslekler' },
  { word: 'sekreter', category: 'Meslekler' },
  { word: 'noter', category: 'Meslekler' },
  { word: 'penaltı', category: 'Spor ve oyun' },
  { word: 'korner', category: 'Spor ve oyun' },
  { word: 'ofsayt', category: 'Spor ve oyun' },
  { word: 'smaç', category: 'Spor ve oyun' },
  { word: 'biatlon', category: 'Spor ve oyun' },
  { word: 'kırağı', category: 'Doğa ve hava' },
  { word: 'sağanak', category: 'Doğa ve hava' },
  { word: 'meltem', category: 'Doğa ve hava' },
  { word: 'lodos', category: 'Doğa ve hava' },
  { word: 'girdap', category: 'Doğa ve hava' },
  { word: 'çağlayan', category: 'Doğa ve hava' },
  { word: 'pınar', category: 'Doğa ve hava' },
  { word: 'körfez', category: 'Doğa ve hava' },
  { word: 'kumul', category: 'Doğa ve hava' },
  { word: 'bozkır', category: 'Doğa ve hava' },
  { word: 'otoban', category: 'Ulaşım' },
  { word: 'bariyer', category: 'Ulaşım' },
  { word: 'refüj', category: 'Ulaşım' },
  { word: 'silecek', category: 'Ulaşım' },
  { word: 'direksiyon', category: 'Ulaşım' },
  { word: 'debriyaj', category: 'Ulaşım' },
  { word: 'egzoz', category: 'Ulaşım' },
  { word: 'römork', category: 'Ulaşım' },
  { word: 'karatahta', category: 'Okul ve kampüs' },
  { word: 'kürsü', category: 'Okul ve kampüs' },
  { word: 'sözlük', category: 'Okul ve kampüs' },
  { word: 'atlas', category: 'Okul ve kampüs' },
  { word: 'kronometre', category: 'Okul ve kampüs' },
  { word: 'teorem', category: 'Okul ve kampüs' },
  { word: 'kaval', category: 'Müzik ve sanat' },
  { word: 'sipsi', category: 'Müzik ve sanat' },
  { word: 'tulum', category: 'Müzik ve sanat' },
  { word: 'mandolin', category: 'Müzik ve sanat' },
  { word: 'timpani', category: 'Müzik ve sanat' },
  { word: 'gramofon', category: 'Müzik ve sanat' },
  { word: 'pikap', category: 'Müzik ve sanat' },
  { word: 'kaset', category: 'Müzik ve sanat' },
  { word: 'istasyon', category: 'Şehir hayatı' },
  { word: 'kule', category: 'Şehir hayatı' },
  { word: 'sarnıç', category: 'Şehir hayatı' },
];

/** Turkish letter frequency, most common first; the bot tries letters in this order. */
const FREQUENCY = [...'aeinrlıkdmtuysobüşzgçphvğcfjö'];

const emptyBoard = (): PracticeBoard => ({
  guessed: [],
  wrong: 0,
  solved: false,
  done: false,
  doneAt: null,
  points: 0,
});

const letterList = (word: string) => [...word];

export const patternOf = (word: string, board: PracticeBoard): (string | null)[] => {
  const guessed = new Set(board.guessed);
  return letterList(word).map((letter) => (board.solved || guessed.has(letter) ? letter : null));
};

/** Points of a closed board: solved boards reward lives and speed, others what they opened. */
export const practiceScore = ({
  solved,
  wrong,
  revealed,
  secondsLeft,
}: {
  solved: boolean;
  wrong: number;
  revealed: number;
  secondsLeft: number;
}): number => {
  if (!solved) return revealed;
  const livesLeft = Math.max(0, PRACTICE_MAX_WRONG - wrong);
  return 10 + livesLeft * 2 + Math.floor(Math.max(0, secondsLeft) / 6);
};

const pointsFor = (word: string, board: PracticeBoard, endsAt: number, now: number) =>
  practiceScore({
    solved: board.solved,
    wrong: board.wrong,
    revealed: patternOf(word, board).filter(Boolean).length,
    secondsLeft: Math.floor((endsAt - (board.doneAt ?? now)) / 1000),
  });

const other = (key: 'host' | 'guest') => (key === 'host' ? 'guest' : 'host');

const settle = (game: PracticeGame, now: number): PracticeGame => {
  if (game.phase === 'finished') return game;
  const { host, guest } = game;
  // The human's board closing (or the clock) ends practice; the opponent stops
  // being asked for moves but its score is frozen where it is.
  if (!host.done && now < game.endsAt) return game;
  const close = (board: PracticeBoard) =>
    board.done
      ? board
      : {
          ...board,
          done: true,
          doneAt: now,
          points: pointsFor(game.word, board, game.endsAt, now),
        };
  const closedHost = close(host);
  const closedGuest = close(guest);
  const winner =
    closedHost.points === closedGuest.points
      ? null
      : closedHost.points > closedGuest.points
        ? 'host'
        : 'guest';
  const reason = closedHost.solved || closedGuest.solved ? 'solved' : 'board_lost';
  return {
    ...game,
    phase: 'finished',
    host: closedHost,
    guest: closedGuest,
    result: { winner, reason },
  };
};

const withBoard = (
  game: PracticeGame,
  key: 'host' | 'guest',
  board: PracticeBoard,
  now: number
): PracticeGame => settle({ ...game, [key]: board }, now);

/** A practice word, uniformly from the whole list. */
export const pickPracticeWord = (random: () => number = Math.random) =>
  PRACTICE_WORDS[Math.min(PRACTICE_WORDS.length - 1, Math.floor(random() * PRACTICE_WORDS.length))];

export const createPracticeGame = ({
  now = Date.now(),
  word = PRACTICE_WORDS[0],
}: {
  now?: number;
  word?: { word: string; category: string };
} = {}): PracticeGame => ({
  word: word.word,
  category: word.category,
  length: letterList(word.word).length,
  startedAt: now,
  endsAt: now + PRACTICE_ROUND_MS,
  host: emptyBoard(),
  guest: emptyBoard(),
  phase: 'open',
  result: null,
});

const applyLetter = (
  game: PracticeGame,
  key: 'host' | 'guest',
  letter: string,
  now: number
): PracticeResult => {
  const board = game[key];
  if (board.done || game.phase === 'finished') return { game, error: 'BOARD_DONE' as const };
  if (board.guessed.includes(letter)) return { game, error: 'ALREADY_GUESSED' as const };
  const next = { ...board, guessed: [...board.guessed, letter] };
  if (!game.word.includes(letter)) next.wrong = board.wrong + 1;
  else if (patternOf(game.word, next).every(Boolean)) next.solved = true;
  if (next.solved || next.wrong >= PRACTICE_MAX_WRONG) {
    next.done = true;
    next.doneAt = now;
  }
  next.points = pointsFor(game.word, next, game.endsAt, now);
  return { game: withBoard(game, key, next, now), error: null };
};

export const guessLetter = (
  game: PracticeGame,
  key: 'host' | 'guest',
  letter: string,
  now = Date.now()
): PracticeResult => {
  const clean = normalizeLetter(letter) ?? '';
  if (!clean) return { game, error: 'INVALID_LETTER' as const };
  return applyLetter(game, key, clean, now);
};

export const solveWord = (
  game: PracticeGame,
  key: 'host' | 'guest',
  word: string,
  now = Date.now()
): PracticeResult => {
  const board = game[key];
  if (board.done || game.phase === 'finished') return { game, error: 'BOARD_DONE' as const };
  const clean = normalizeGuess(word);
  const next = { ...board };
  if (clean && clean === game.word) next.solved = true;
  else next.wrong = Math.min(PRACTICE_MAX_WRONG, board.wrong + PRACTICE_SOLVE_PENALTY);
  if (next.solved || next.wrong >= PRACTICE_MAX_WRONG) {
    next.done = true;
    next.doneAt = now;
  }
  next.points = pointsFor(game.word, next, game.endsAt, now);
  return { game: withBoard(game, key, next, now), error: null };
};

/** The letter the bot tries next: usually one of the word's, never a repeat. */
export const chooseBotLetter = (
  word: string,
  board: PracticeBoard,
  random: () => number = Math.random
): string | null => {
  const guessed = new Set(board.guessed);
  const free = FREQUENCY.filter((letter) => !guessed.has(letter));
  const inside = free.filter((letter) => word.includes(letter));
  const outside = free.filter((letter) => !word.includes(letter));
  const pool = random() < BOT_MISTAKE_RATE && outside.length ? outside : inside.length ? inside : free;
  return pool[0] ?? null;
};

/** Whether the bot now knows enough to try the whole word. */
export const shouldBotSolve = (
  word: string,
  board: PracticeBoard,
  random: () => number = Math.random
): boolean => {
  const missing = new Set(letterList(word).filter((letter) => !board.guessed.includes(letter)));
  return missing.size <= 1 && random() < BOT_SOLVE_CHANCE;
};

/** Read-only projection of one board, in the shape the ranked screen uses. */
export const practiceView = (game: PracticeGame, key: 'host' | 'guest'): PracticeView => {
  const board = game[key];
  return {
    pattern: patternOf(game.word, board),
    guessed: [...board.guessed],
    wrong: board.wrong,
    solved: board.solved,
    done: board.done,
    points: board.points,
  };
};

export const opponentOf = other;

/** Closes practice when the 60 s clock runs out. */
export const advancePractice = (game: PracticeGame, now = Date.now()) => settle(game, now);
