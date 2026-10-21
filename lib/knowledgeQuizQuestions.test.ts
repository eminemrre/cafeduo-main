import {
  CORRECT_POINTS,
  QUESTION_TIME_SECONDS,
  buildQuizRoundSet,
  halfAndHalf,
  quizSeed,
  scoreAnswer,
} from './knowledgeQuizQuestions';
import { GAME_REGISTRY, QUIZ_GAME_TYPE } from '../shared/gameRegistry';

describe('bot practice question set', () => {
  it('gives the same seed the same questions and option order', () => {
    expect(buildQuizRoundSet(quizSeed(42), 10)).toEqual(buildQuizRoundSet(quizSeed(42), 10));
    expect(buildQuizRoundSet(quizSeed(42), 10)).not.toEqual(buildQuizRoundSet(quizSeed(43), 10));
  });

  it('keeps the correct answer behind answerIndex after shuffling the options', () => {
    for (const question of buildQuizRoundSet('x', 10)) {
      expect(question.options).toHaveLength(4);
      expect(question.answerIndex).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex).toBeLessThan(4);
      expect(new Set(question.options).size).toBe(4);
    }
  });

  it('never repeats a question within a practice match', () => {
    const questions = buildQuizRoundSet('z', 10).map((q) => q.question);
    expect(new Set(questions).size).toBe(10);
  });
});

describe('halfAndHalf', () => {
  it('hides two different wrong options, the same ones for both players', () => {
    for (const question of buildQuizRoundSet('h', 10)) {
      const hidden = halfAndHalf(question, 'bot-quiz:9');
      expect(new Set(hidden).size).toBe(2);
      expect(hidden).not.toContain(question.answerIndex);
      expect(halfAndHalf(question, 'bot-quiz:9')).toEqual(hidden);
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

  it('never beats the score cap in the game registry', () => {
    const entry = GAME_REGISTRY[QUIZ_GAME_TYPE];
    const rounds = entry.maxRounds ?? 0;
    let total = 0;
    let streak = 0;

    for (let index = 0; index < rounds; index += 1) {
      const answer = scoreAnswer({
        correct: true,
        secondsLeft: QUESTION_TIME_SECONDS,
        streakBefore: streak,
        isFinal: index === rounds - 1,
      });
      total += answer.points;
      streak = answer.streak;
    }

    expect(total).toBe(320);
    expect(entry.maxScore).toBe(total);
  });
});
