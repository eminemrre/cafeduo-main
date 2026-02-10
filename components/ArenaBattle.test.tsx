import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ArenaBattle } from './ArenaBattle';
import { User } from '../types';

describe('ArenaBattle', () => {
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
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('records a shot when user fires', () => {
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const fireButton = screen.getByTestId('tank-fire-button');
    const shotCard = screen.getByText('Son Atışın').parentElement;
    expect(shotCard).toBeTruthy();
    expect(shotCard?.textContent).toContain('-');

    fireEvent.click(fireButton);

    expect(screen.getByText(/Atışın:/i)).toBeInTheDocument();
    expect(shotCard?.textContent).not.toContain('-');
  });

  it('completes match after 5 rounds in bot mode', () => {
    const onGameEnd = jest.fn();

    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={onGameEnd}
        onLeave={jest.fn()}
      />
    );

    const fireButton = screen.getByTestId('tank-fire-button');
    for (let i = 0; i < 5; i += 1) {
      fireEvent.click(fireButton);
      if (i < 4) {
        act(() => {
          jest.advanceTimersByTime(800);
        });
      }
    }

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onGameEnd).toHaveBeenCalledWith('emin', 10);
  });
});
