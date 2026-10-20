import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { KnowledgeQuiz } from './KnowledgeQuiz';
import { User } from '../types';
import { buildQuizRoundSet, quizSeed } from '../lib/knowledgeQuizQuestions';

// PixiJS overlay requires WebGL; mock as inert canvas in tests so the
// dynamic import + app.init() don't fire in jsdom.
jest.mock('./games/QuizStageCanvas', () => ({
  QuizStageCanvas: React.forwardRef(function MockQuizStageCanvas(
    _props: { className?: string },
    _ref: React.Ref<unknown>
  ) {
    return <canvas data-testid="quiz-pixi-canvas" />;
  }),
}));

describe('KnowledgeQuiz', () => {
  const mockUser: User = {
    id: 1,
    username: 'emin',
    email: 'emin@example.com',
    points: 120,
    wins: 0,
    gamesPlayed: 0,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.01);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('plays all rounds and resolves local winner in bot mode', () => {
    const onGameEnd = jest.fn();
    const quizSet = buildQuizRoundSet(quizSeed(1), 10);
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

    quizSet.forEach((question, idx) => {
      expect(screen.getByTestId('knowledge-question')).toHaveTextContent(question.question);
      fireEvent.click(screen.getByTestId(`knowledge-option-${question.answerIndex}`));
      if (idx < quizSet.length - 1) {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Instant answers: 10 + 15 seconds each, +5 from the third in a row, the last one doubled.
    expect(onGameEnd).toHaveBeenCalledWith(
      'emin',
      10,
      expect.objectContaining({ kind: 'quiz', playerScore: 320, correctAnswers: 10 })
    );
  });

  it('asks both players of a match the same questions in the same order', () => {
    const { unmount } = render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={7}
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    const first = screen.getAllByTestId(/knowledge-option-\d/).map((option) => option.textContent);
    const question = screen.getByTestId('knowledge-question').textContent;
    unmount();
    render(
      <KnowledgeQuiz
        currentUser={{ ...mockUser, id: 2, username: 'rakip' }}
        gameId={7}
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    expect(screen.getByTestId('knowledge-question').textContent).toBe(question);
    expect(
      screen.getAllByTestId(/knowledge-option-\d/).map((option) => option.textContent)
    ).toEqual(first);
  });

  it('hides two wrong options once with the 50:50 joker', () => {
    const [question] = buildQuizRoundSet(quizSeed(1), 10);
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('knowledge-joker'));
    const disabled = [0, 1, 2, 3].filter(
      (idx) => (screen.getByTestId(`knowledge-option-${idx}`) as HTMLButtonElement).disabled
    );
    expect(disabled).toHaveLength(2);
    expect(disabled).not.toContain(question.answerIndex);
    expect(screen.getByTestId('knowledge-joker')).toBeDisabled();
    expect(screen.getByTestId('knowledge-joker')).toHaveTextContent('Joker kullanıldı');
  });

  it('shows the category and level of the question and counts a streak', () => {
    const quizSet = buildQuizRoundSet(quizSeed(1), 10);
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );
    expect(screen.getByTestId('knowledge-meta')).toHaveTextContent(quizSet[0].category);
    for (const question of quizSet.slice(0, 2)) {
      fireEvent.click(screen.getByTestId(`knowledge-option-${question.answerIndex}`));
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(screen.getByTestId('knowledge-streak')).toHaveTextContent('Seri: 2');
  });

  it('calls onLeave from header button', () => {
    const onLeave = jest.fn();
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={onLeave}
      />
    );

    fireEvent.click(screen.getByText('Oyundan çık'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
