import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Okey101Social } from './Okey101Social';
import { initOkeyState } from '../lib/game-logic/okey101Social';
import type { User } from '../types';

const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
};
const joinGame = jest.fn();
const emitMove = jest.fn();

jest.mock('../lib/socket', () => ({
  socketService: {
    getSocket: jest.fn(() => mockSocket),
    joinGame: (...args: unknown[]) => joinGame(...args),
    emitMove: (...args: unknown[]) => emitMove(...args),
  },
}));

describe('Okey101Social', () => {
  const currentUser: User = {
    id: 1,
    username: 'emin',
    email: 'emin@example.com',
    points: 10,
    wins: 0,
    gamesPlayed: 0,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    joinGame.mockClear();
    emitMove.mockClear();
    mockSocket.on.mockClear();
    mockSocket.off.mockClear();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('shows waiting state and exits it after host bootstrap', () => {
    render(
      <Okey101Social
        currentUser={currentUser}
        gameId={1}
        opponentName="Rakip"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    expect(screen.getByText('Rakip bekleniyor...')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(joinGame).toHaveBeenCalledWith('1');
    expect(emitMove).toHaveBeenCalledWith('1', expect.objectContaining({ type: 'full_state' }));
    expect(screen.getByRole('button', { name: /taş çek/i })).toBeInTheDocument();
  });

  test('renders finished shell with lobby return after recovery update', () => {
    render(
      <Okey101Social
        currentUser={currentUser}
        gameId={2}
        opponentName="Rakip"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const recovered = initOkeyState('emin', 'Rakip');
    recovered.finished = true;
    recovered.winner = 'emin';

    const stateHandler = mockSocket.on.mock.calls.find(([event]) => event === 'game_state_updated')?.[1];
    expect(stateHandler).toBeInstanceOf(Function);

    act(() => {
      stateHandler(recovered);
    });

    expect(screen.getByRole('button', { name: /lobiye dön/i })).toBeInTheDocument();
  });

  test('delegates waiting-screen leave action', () => {
    const onLeave = jest.fn();
    render(
      <Okey101Social
        currentUser={currentUser}
        gameId={3}
        opponentName="Rakip"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={onLeave}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /oyundan çık/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  test('draws a tile in bot mode and flips the action prompt', () => {
    render(
      <Okey101Social
        currentUser={currentUser}
        gameId={4}
        opponentName="Rakip"
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /taş çek/i }));
    expect(screen.getByRole('button', { name: /taş at/i })).toBeInTheDocument();
  });
});
