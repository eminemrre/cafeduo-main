import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { KnowledgeQuiz } from './KnowledgeQuiz';
import { User } from '../types';

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
    render(
      <KnowledgeQuiz
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

    const correctAnswers = [2, 2, 2, 1, 1];
    correctAnswers.forEach((answer, idx) => {
      fireEvent.click(screen.getByTestId(`knowledge-option-${answer}`));
      if (idx < correctAnswers.length - 1) {
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

