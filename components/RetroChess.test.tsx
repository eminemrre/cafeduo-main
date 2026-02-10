import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RetroChess } from './RetroChess';
import { User } from '../types';

jest.mock('../lib/gameAudio', () => ({
  playGameSfx: jest.fn(),
}));

describe('RetroChess (classic)', () => {
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
    jest.spyOn(Math, 'random').mockReturnValue(0.15);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders classic board and allows legal player move in bot mode', () => {
    render(
      <RetroChess
        currentUser={mockUser}
        gameId={null}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    expect(screen.getByTestId('retro-chess')).toBeInTheDocument();
    expect(screen.getByTestId('retro-chess-board')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('retro-chess-square-e2'));
    fireEvent.click(screen.getByTestId('retro-chess-square-e4'));

    expect(screen.getByText(/BOT düşünüyor/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.getByText(/Sıra sende/i)).toBeInTheDocument();
  });

  it('calls onLeave when user exits', () => {
    const onLeave = jest.fn();
    render(
      <RetroChess
        currentUser={mockUser}
        gameId={null}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={onLeave}
      />
    );

    fireEvent.click(screen.getByText('Oyundan Çık'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

