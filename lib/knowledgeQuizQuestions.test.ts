import {
  CORRECT_POINTS,
  QUESTION_TIME_SECONDS,
  buildQuizRoundSet,
  halfAndHalf,
  quizSeed,
  scoreAnswer,
} from './knowledgeQuizQuestions';
import { QUIZ_QUESTION_BANK, type QuizBankEntry } from './quizQuestionBank';

const fakeBank: QuizBankEntry[] = ['A', 'B', 'C'].flatMap((category) =>
  Array.from({ length: 6 }, (_, i) => ({
    question: `${category} sorusu ${i}`,
    answer: `${category}${i} doğru`,
    wrong: [`${category}${i} y1`, `${category}${i} y2`, `${category}${i} y3`] as [
      string,
      string,
      string,
    ],
    category,
    level: 'zor' as const,
  }))
);

describe('buildQuizRoundSet', () => {
  it('gives the same seed the same questions and option order', () => {
    expect(buildQuizRoundSet(quizSeed(42), 10, fakeBank)).toEqual(
      buildQuizRoundSet(quizSeed(42), 10, fakeBank)
    );
    expect(buildQuizRoundSet(quizSeed(42), 10, fakeBank)).not.toEqual(
      buildQuizRoundSet(quizSeed(43), 10, fakeBank)
    );
  });

  it('keeps the correct answer behind answerIndex after shuffling the options', () => {
    for (const question of buildQuizRoundSet('x', 18, fakeBank)) {
      expect(question.options[question.answerIndex]).toMatch(/doğru$/);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it('moves between categories instead of staying on one', () => {
    const categories = buildQuizRoundSet('y', 9, fakeBank).map((q) => q.category);
    for (let i = 0; i + 2 < categories.length; i += 3) {
      expect(new Set(categories.slice(i, i + 3)).size).toBe(3);
    }
  });

  it('never repeats a question within a match', () => {
    const questions = buildQuizRoundSet('z', 18, fakeBank).map((q) => q.question);
    expect(new Set(questions).size).toBe(18);
  });

  it('spreads the correct answer over all four positions', () => {
    const positions = new Set(
      buildQuizRoundSet('w', 18, fakeBank).map((question) => question.answerIndex)
    );
    expect(positions.size).toBe(4);
  });
});

describe('halfAndHalf', () => {
  it('hides two different wrong options, the same ones for both players', () => {
    for (const question of buildQuizRoundSet('h', 18, fakeBank)) {
      const hidden = halfAndHalf(question, 'quiz:9');
      expect(new Set(hidden).size).toBe(2);
      expect(hidden).not.toContain(question.answerIndex);
      expect(halfAndHalf(question, 'quiz:9')).toEqual(hidden);
    }
  });
});

describe('scoreAnswer', () => {
  it('gives nothing for a wrong answer and breaks the streak', () => {
    expect(
      scoreAnswer({ correct: false, secondsLeft: 12, streakBefore: 4, isFinal: false })
    ).toEqual({ points: 0, timeBonus: 0, streakBonus: 0, doubled: false, streak: 0 });
  });

  it('adds a point for every second left', () => {
    expect(
      scoreAnswer({ correct: true, secondsLeft: 9, streakBefore: 0, isFinal: false }).points
    ).toBe(CORRECT_POINTS + 9);
    expect(
      scoreAnswer({ correct: true, secondsLeft: 99, streakBefore: 0, isFinal: false }).timeBonus
    ).toBe(QUESTION_TIME_SECONDS);
  });

  it('adds the streak bonus from the third correct answer in a row', () => {
    expect(
      scoreAnswer({ correct: true, secondsLeft: 0, streakBefore: 1, isFinal: false }).streakBonus
    ).toBe(0);
    const third = scoreAnswer({ correct: true, secondsLeft: 0, streakBefore: 2, isFinal: false });
    expect(third).toMatchObject({ streak: 3, streakBonus: 5, points: CORRECT_POINTS + 5 });
  });

  it('doubles the last question', () => {
    expect(
      scoreAnswer({ correct: true, secondsLeft: 5, streakBefore: 0, isFinal: true })
    ).toMatchObject({ doubled: true, points: (CORRECT_POINTS + 5) * 2 });
  });
});

describe('the question bank', () => {
  it('is large enough for many matches without repeats', () => {
    expect(QUIZ_QUESTION_BANK.length).toBeGreaterThanOrEqual(300);
  });

  it('has one correct and three distinct wrong options per question', () => {
    for (const entry of QUIZ_QUESTION_BANK) {
      const options = [entry.answer, ...entry.wrong].map((o) => o.trim().toLocaleLowerCase('tr'));
      expect(new Set(options).size).toBe(4);
      expect(entry.question.length).toBeLessThanOrEqual(160);
    }
  });

  it('asks every question once', () => {
    const texts = QUIZ_QUESTION_BANK.map((e) => e.question.trim().toLocaleLowerCase('tr'));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('is general knowledge, not software', () => {
    const software = /\b(http|cpu|python|javascript|html|css|sql|byte|api|algoritma|yazılım)\b/i;
    for (const entry of QUIZ_QUESTION_BANK) {
      expect(`${entry.question} ${entry.answer}`).not.toMatch(software);
    }
  });

  it('covers at least eight categories', () => {
    expect(new Set(QUIZ_QUESTION_BANK.map((e) => e.category)).size).toBeGreaterThanOrEqual(8);
  });
});
