import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { OddEvenSprint } from './OddEvenSprint';
import { User } from '../types';

describe('OddEvenSprint', () => {
  const mockUser: User = {
    id: 1,
    username: 'emin',
    email: 'emin@example.com',
    points: 100,
    wins: 0,
    gamesPlayed: 0,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0.05);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('plays 5 rounds and emits winner callback', () => {
    const onGameEnd = jest.fn();
    render(
      <OddEvenSprint
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(screen.getByTestId('guess-even'));
      // Advance through the number reveal animation (500ms) and round transition (1200ms)
      act(() => {
        jest.advanceTimersByTime(2000);
      });
    }

    // Advance through the finalizeMatch timeout (900ms for bot mode)
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Açılan Sayı')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(onGameEnd).toHaveBeenCalledWith('emin', 10);
  });

  it('calls onLeave from header button', () => {
    const onLeave = jest.fn();
    render(
      <OddEvenSprint
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
