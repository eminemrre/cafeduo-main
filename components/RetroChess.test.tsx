import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RetroChess } from './RetroChess';
import { User } from '../types';

describe('RetroChess', () => {
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
    jest.spyOn(Math, 'random').mockReturnValue(0.2);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders board and allows selecting candidate squares', () => {
    render(
      <RetroChess
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    expect(screen.getByTestId('retro-chess')).toBeInTheDocument();
    expect(screen.getByTestId('retro-chess-board')).toBeInTheDocument();

    const optionSquare = screen.getAllByRole('button', { name: /[a-h][1-8]/i })[0];
    fireEvent.click(optionSquare);

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.getByText(/Tur/i)).toBeInTheDocument();
  });

  it('calls onLeave when user exits', () => {
    const onLeave = jest.fn();
    render(
      <RetroChess
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
