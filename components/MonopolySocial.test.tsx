import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MonopolySocial } from './MonopolySocial';
import { initMonopolyState } from '../lib/game-logic/monopolySocial';
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

describe('MonopolySocial', () => {
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
    jest.spyOn(Math, 'random').mockReturnValue(0.2);
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

  test('shows waiting screen, then host bootstrap exposes the board', () => {
    render(
      <MonopolySocial
        currentUser={currentUser}
        gameId={1}
        opponentName="Rakip"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    expect(screen.getByText('Rakip bekleniyor...')).toBeInTheDocument();
    expect(joinGame).toHaveBeenCalledWith('1');

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(emitMove).toHaveBeenCalledWith('1', expect.objectContaining({ type: 'full_state' }));
    expect(screen.getByText(/Monopoly Sosyal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /zar at/i })).toBeInTheDocument();
  });

  test('renders pending purchase controls after a full_state recovery event', () => {
    render(
      <MonopolySocial
        currentUser={currentUser}
        gameId={2}
        opponentName="Rakip"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const recovered = initMonopolyState('emin', 'Rakip');
    recovered.pendingPurchase = { owner: 'host', tileId: 1 };

    const opponentMoveHandler = mockSocket.on.mock.calls.find(([event]) => event === 'opponent_move')?.[1];
    expect(opponentMoveHandler).toBeInstanceOf(Function);

    act(() => {
      opponentMoveHandler({ move: { type: 'full_state', state: recovered } });
    });

    expect(screen.getByRole('button', { name: /satın al/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pas geç/i })).toBeInTheDocument();
  });

  test('delegates leave action from waiting screen', () => {
    const onLeave = jest.fn();
    render(
      <MonopolySocial
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

  test('runs a bot-mode dice turn and exposes the last dice result', () => {
    render(
      <MonopolySocial
        currentUser={currentUser}
        gameId={4}
        opponentName="Rakip"
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /zar at/i }));
    expect(screen.getByText(/zar atılıyor/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.getByText(/satın alabilirsin|pas geçildi|satın alındı/i)).toBeInTheDocument();
  });
});
