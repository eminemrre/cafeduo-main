/**
 * Bilgi Yarışı: the question pool and the rules of a match.
 *
 * Both players of a match must see the same questions with the options in the same order, so
 * everything here is derived from one seed: the game's id (quizSeed). A solo game against the
 * bot gets a fresh seed per match.
 */
import { QUIZ_QUESTION_BANK, type QuizBankEntry, type QuizLevel } from './quizQuestionBank';

export type { QuizLevel };

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  answerIndex: number;
  category: string;
  level: QuizLevel;
}

/** Seconds a player has for one question. */
export const QUESTION_TIME_SECONDS = 15;
/** Points for a correct answer, before the time bonus. */
export const CORRECT_POINTS = 10;
/** Extra points per correct answer from the third correct answer in a row. */
export const STREAK_BONUS = 5;
export const STREAK_FROM = 3;

const hashSeed = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

/** The seed both players of a match share. */
export const quizSeed = (gameId: string | number) => `quiz:${String(gameId)}`;

const toQuestion = (entry: QuizBankEntry, random: () => number): QuizQuestion => {
  const options = shuffle([entry.answer, ...entry.wrong], random) as QuizQuestion['options'];
  return {
    question: entry.question,
    options,
    answerIndex: options.indexOf(entry.answer),
    category: entry.category,
    level: entry.level,
  };
};

/**
 * The questions of one match: drawn from every category in turn so a match never stays on one
 * subject, with the options shuffled. The same seed always gives the same set.
 */
export const buildQuizRoundSet = (
  seedSource: string | number,
  roundCount: number,
  bank: readonly QuizBankEntry[] = QUIZ_QUESTION_BANK
): QuizQuestion[] => {
  const random = mulberry32(hashSeed(String(seedSource || 'cafeduo-quiz-seed')));
  const count = Math.max(1, Math.min(bank.length, Math.floor(roundCount || 0)));

  const byCategory = new Map<string, QuizBankEntry[]>();
  for (const entry of bank) {
    const list = byCategory.get(entry.category) ?? [];
    list.push(entry);
    byCategory.set(entry.category, list);
  }
  const piles = shuffle([...byCategory.values()], random).map((pile) => shuffle(pile, random));

  const picked: QuizBankEntry[] = [];
  for (let turn = 0; picked.length < count; turn += 1) {
    const pile = piles[turn % piles.length];
    const entry = pile.pop();
    if (entry) picked.push(entry);
    if (piles.every((p) => p.length === 0)) break;
  }
  return picked.map((entry) => toQuestion(entry, random));
};

/** "Yarı yarıya": the two wrong options to hide, the same for both players. */
export const halfAndHalf = (question: QuizQuestion, seedSource: string): [number, number] => {
  const random = mulberry32(hashSeed(`${seedSource}|${question.question}`));
  const wrong = shuffle(
    [0, 1, 2, 3].filter((index) => index !== question.answerIndex),
    random
  );
  return [wrong[0], wrong[1]];
};

export interface AnswerScore {
  points: number;
  timeBonus: number;
  streakBonus: number;
  doubled: boolean;
  /** Correct answers in a row, this one included (0 after a wrong answer). */
  streak: number;
}

/**
 * Points for one answer: 10 for a correct answer, +1 for every second left, +5 from the third
 * correct answer in a row, and the last question counts double.
 */
export const scoreAnswer = ({
  correct,
  secondsLeft,
  streakBefore,
  isFinal,
}: {
  correct: boolean;
  secondsLeft: number;
  streakBefore: number;
  isFinal: boolean;
}): AnswerScore => {
  if (!correct) return { points: 0, timeBonus: 0, streakBonus: 0, doubled: false, streak: 0 };
  const streak = streakBefore + 1;
  const timeBonus = Math.max(0, Math.min(QUESTION_TIME_SECONDS, Math.floor(secondsLeft)));
  const streakBonus = streak >= STREAK_FROM ? STREAK_BONUS : 0;
  const subtotal = CORRECT_POINTS + timeBonus + streakBonus;
  return {
    points: isFinal ? subtotal * 2 : subtotal,
    timeBonus,
    streakBonus,
    doubled: isFinal,
    streak,
  };
};
