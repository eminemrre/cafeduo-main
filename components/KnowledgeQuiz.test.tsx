import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { KnowledgeQuiz } from './KnowledgeQuiz';
import { User } from '../types';
import { buildQuizRoundSet } from '../lib/knowledgeQuizQuestions';

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
    const quizSet = buildQuizRoundSet('1:emin', 10);
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
          jest.advanceTimersByTime(800);
        });
      }
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onGameEnd).toHaveBeenCalledWith('emin', 10);
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

    fireEvent.click(screen.getByText('Oyundan Çık'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
