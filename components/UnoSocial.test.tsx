import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UnoSocial } from './UnoSocial';
import { initUnoState } from '../lib/game-logic/unoSocial';
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

describe('UnoSocial', () => {
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

  test('shows waiting screen and host bootstrap moves to playable shell', () => {
    render(
      <UnoSocial
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
    expect(screen.getByRole('button', { name: /kart çek/i })).toBeInTheDocument();
  });

  test('renders finished state from recovered game_state update', () => {
    render(
      <UnoSocial
        currentUser={currentUser}
        gameId={2}
        opponentName="Rakip"
        isBot={false}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const recovered = initUnoState('emin', 'Rakip');
    recovered.finished = true;
    recovered.winner = 'emin';

    const stateHandler = mockSocket.on.mock.calls.find(([event]) => event === 'game_state_updated')?.[1];
    expect(stateHandler).toBeInstanceOf(Function);

    act(() => {
      stateHandler(recovered);
    });

    expect(screen.getByRole('button', { name: /lobiye dön/i })).toBeInTheDocument();
  });

  test('delegates leave action on waiting screen', () => {
    const onLeave = jest.fn();
    render(
      <UnoSocial
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

  test('draws a card in bot mode and keeps the shell interactive', () => {
    render(
      <UnoSocial
        currentUser={currentUser}
        gameId={4}
        opponentName="Rakip"
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /kart çek/i }));
    expect(screen.getByText(/oynadı|kart çekti|sıra sende/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /kart çek/i })).toBeInTheDocument();
  });
});
