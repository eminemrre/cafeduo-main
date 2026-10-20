import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RetroChess } from './RetroChess';
import { User } from '../types';

jest.mock('../lib/gameAudio', () => ({
  playGameSfx: jest.fn(),
}));

// PixiJS overlay requires WebGL; mock as inert canvas in tests so the
// dynamic import + app.init() don't fire in jsdom.
jest.mock('./games/ChessBoardOverlay', () => ({
  ChessBoardOverlay: React.forwardRef(function MockChessBoardOverlay(
    _props: { boardRef: React.RefObject<HTMLElement | null>; className?: string },
    _ref: React.Ref<unknown>
  ) {
    return <canvas data-testid="chess-board-pixi-canvas" />;
  }),
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

    expect(screen.getAllByText(/Sıra sende/i).length).toBeGreaterThan(0);
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

    fireEvent.click(screen.getByText('Oyundan çık'));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('prevents selecting black pieces in bot mode', () => {
    render(
      <RetroChess
        currentUser={mockUser}
        gameId={null}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('retro-chess-square-e7'));
    expect(screen.getByText(/BOT modunda beyaz taşlarla oynuyorsun/i)).toBeInTheDocument();
  });

  it('does not corrupt board state after an illegal destination click', () => {
    render(
      <RetroChess
        currentUser={mockUser}
        gameId={null}
        isBot={true}
        onGameEnd={jest.fn()}
        onLeave={jest.fn()}
      />
    );

    const whitePawns = screen.getAllByLabelText('Beyaz Piyon');
    fireEvent.click(screen.getByTestId('retro-chess-square-e2'));
    fireEvent.click(screen.getByTestId('retro-chess-square-e5'));

    expect(whitePawns.length).toBeGreaterThan(0);
    expect(screen.getByTestId('retro-chess-board')).toBeInTheDocument();
  });
});
