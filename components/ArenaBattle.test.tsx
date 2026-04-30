import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ArenaBattle, clampGauge, pointsFromShot, shotLabel } from './ArenaBattle';
import { User } from '../types';

jest.mock('../lib/gameAudio', () => ({
  playGameSfx: jest.fn(),
}));

jest.mock('../lib/socket', () => ({
  socketService: {
    isConnected: jest.fn(() => true),
    onConnectionChange: jest.fn(() => jest.fn()),
    getSocket: jest.fn(() => ({ on: jest.fn(), off: jest.fn() })),
    joinGame: jest.fn(),
  },
}));

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
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('scores shots by distance from the center', () => {
    expect(clampGauge(140)).toBe(100);
    expect(clampGauge(-10)).toBe(0);
    expect(pointsFromShot(50)).toBe(3);
    expect(pointsFromShot(58)).toBe(2);
    expect(pointsFromShot(65)).toBe(1);
    expect(pointsFromShot(80)).toBe(0);
    expect(shotLabel(50)).toBe('Mükemmel kilit');
  });

  it('renders the reticle game and debug snapshot', () => {
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    expect(screen.getByTestId('arena-battle')).toBeInTheDocument();
    expect(screen.getByTestId('arena-fire-button')).toBeInTheDocument();
    expect(screen.getByText('Nişancı Düellosu')).toBeInTheDocument();

    const renderToText = (window as Window & { render_game_to_text?: () => string }).render_game_to_text;
    expect(renderToText).toBeInstanceOf(Function);
    expect(renderToText?.()).toContain('"gameType":"Nişancı Düellosu"');
    expect(renderToText?.()).toContain('"name":"emin"');
  });

  it('locks a round after firing and advances to the next round', () => {
    render(
      <ArenaBattle
        currentUser={mockUser}
        gameId={1}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const fireButton = screen.getByTestId('arena-fire-button');
    fireEvent.click(fireButton);
    expect(fireButton).toBeDisabled();

    act(() => {
      jest.advanceTimersByTime(800);
    });

    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByTestId('arena-fire-button')).not.toBeDisabled();
  });

  it('finishes in bot mode and reports the winner after five shots', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
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

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(screen.getByTestId('arena-fire-button'));
      act(() => {
        jest.advanceTimersByTime(800);
      });
    }

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onGameEnd).toHaveBeenCalledWith('emin', 10);
  });

  it('calls onLeave from the exit button', () => {
    const onLeave = jest.fn();
    render(
      <ArenaBattle
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
