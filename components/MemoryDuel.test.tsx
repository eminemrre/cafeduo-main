import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryDuel } from './MemoryDuel';
import { api } from '../lib/api';
import { socketService } from '../lib/socket';
import { buildMemoryDeck } from '../lib/game-logic/memoryDuel';

jest.mock('../lib/api', () => ({
  api: {
    games: {
      get: jest.fn(),
      move: jest.fn().mockResolvedValue({}),
    },
  },
}));

const socketHandlers: Record<string, (payload: unknown) => void> = {};
const socketMock = {
  on: jest.fn((event: string, handler: (payload: unknown) => void) => {
    socketHandlers[event] = handler;
  }),
  off: jest.fn((event: string) => {
    delete socketHandlers[event];
  }),
};

jest.mock('../lib/socket', () => ({
  socketService: {
    getSocket: jest.fn(() => socketMock),
    joinGame: jest.fn(),
    emitMove: jest.fn(),
  },
}));

jest.mock('../lib/multiplayer', () => ({
  submitScoreAndWaitForWinner: jest.fn().mockResolvedValue({ winner: 'testuser', finished: true }),
}));

jest.mock('../lib/gameAudio', () => ({
  playGameSfx: jest.fn(),
}));

jest.mock('../lib/game-logic/memoryDuel', () => {
  const actual = jest.requireActual('../lib/game-logic/memoryDuel');
  return {
    ...actual,
    buildMemoryDeck: jest.fn(actual.buildMemoryDeck),
  };
});

const mockApiGamesGet = api.games.get as jest.MockedFunction<typeof api.games.get>;
const mockBuildMemoryDeck = buildMemoryDeck as jest.MockedFunction<typeof buildMemoryDeck>;

const defaultProps = {
  currentUser: { id: '1', username: 'testuser', role: 'user' } as any,
  gameId: 1,
  opponentName: 'opponent',
  isBot: false,
  onGameEnd: jest.fn(),
  onLeave: jest.fn(),
};

describe('MemoryDuel Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
    mockApiGamesGet.mockResolvedValue({ id: 1, status: 'active', hostName: 'testuser' } as any);
    mockBuildMemoryDeck.mockImplementation(jest.requireActual('../lib/game-logic/memoryDuel').buildMemoryDeck);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders the game board with 16 cards and initial scores', async () => {
    render(<MemoryDuel {...defaultProps} />);

    expect(screen.getByText('Neon Hafıza')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength(17);
    });

    const zeros = await screen.findAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onLeave from the leave button', async () => {
    render(<MemoryDuel {...defaultProps} />);

    fireEvent.click(await screen.findByRole('button', { name: /Oyundan Çık/i }));
    expect(defaultProps.onLeave).toHaveBeenCalledTimes(1);
  });

  it('shows bot thinking and missed-turn messages after a non-matching player attempt', async () => {
    mockBuildMemoryDeck.mockReturnValue([
      { id: 0, emoji: '🚀', flippedBy: null, matchedBy: null },
      { id: 1, emoji: '🛸', flippedBy: null, matchedBy: null },
      { id: 2, emoji: '👾', flippedBy: null, matchedBy: null },
      { id: 3, emoji: '🎮', flippedBy: null, matchedBy: null },
      { id: 4, emoji: '⚡', flippedBy: null, matchedBy: null },
      { id: 5, emoji: '🔮', flippedBy: null, matchedBy: null },
      { id: 6, emoji: '🎲', flippedBy: null, matchedBy: null },
      { id: 7, emoji: '🏆', flippedBy: null, matchedBy: null },
      { id: 8, emoji: '🚀', flippedBy: null, matchedBy: null },
      { id: 9, emoji: '🛸', flippedBy: null, matchedBy: null },
      { id: 10, emoji: '👾', flippedBy: null, matchedBy: null },
      { id: 11, emoji: '🎮', flippedBy: null, matchedBy: null },
      { id: 12, emoji: '⚡', flippedBy: null, matchedBy: null },
      { id: 13, emoji: '🔮', flippedBy: null, matchedBy: null },
      { id: 14, emoji: '🎲', flippedBy: null, matchedBy: null },
      { id: 15, emoji: '🏆', flippedBy: null, matchedBy: null },
    ]);

    render(<MemoryDuel {...defaultProps} isBot={true} gameId={null} />);

    const cardButtons = await screen.findAllByRole('button');
    fireEvent.click(cardButtons[1]);
    fireEvent.click(cardButtons[2]);

    act(() => {
      jest.advanceTimersByTime(1600);
    });

    expect(screen.getByText(/opponent düşünüyor/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    act(() => {
      jest.advanceTimersByTime(600);
    });

    act(() => {
      jest.advanceTimersByTime(800);
    });

    await waitFor(() => {
      expect(screen.getByText(/Rakip ıskaladı! Senin sıran\./i)).toBeInTheDocument();
    });
  });

  it('hydrates the board for a multiplayer guest after init_board socket event', async () => {
    const guestDeck = [
      { id: 0, emoji: '🚀', flippedBy: null, matchedBy: null },
      { id: 1, emoji: '🚀', flippedBy: null, matchedBy: null },
      { id: 2, emoji: '🛸', flippedBy: null, matchedBy: null },
      { id: 3, emoji: '🛸', flippedBy: null, matchedBy: null },
      { id: 4, emoji: '👾', flippedBy: null, matchedBy: null },
      { id: 5, emoji: '👾', flippedBy: null, matchedBy: null },
      { id: 6, emoji: '🎮', flippedBy: null, matchedBy: null },
      { id: 7, emoji: '🎮', flippedBy: null, matchedBy: null },
      { id: 8, emoji: '⚡', flippedBy: null, matchedBy: null },
      { id: 9, emoji: '⚡', flippedBy: null, matchedBy: null },
      { id: 10, emoji: '🔮', flippedBy: null, matchedBy: null },
      { id: 11, emoji: '🔮', flippedBy: null, matchedBy: null },
      { id: 12, emoji: '🎲', flippedBy: null, matchedBy: null },
      { id: 13, emoji: '🎲', flippedBy: null, matchedBy: null },
      { id: 14, emoji: '🏆', flippedBy: null, matchedBy: null },
      { id: 15, emoji: '🏆', flippedBy: null, matchedBy: null },
    ];
    mockApiGamesGet.mockResolvedValue({ id: 1, status: 'active', hostName: 'host-user' } as any);

    render(<MemoryDuel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Kurucunun kartları dağıtması bekleniyor/i)).toBeInTheDocument();
    });

    act(() => {
      socketHandlers.opponent_move?.({
        gameId: 1,
        player: 'host-user',
        move: {
          action: 'init_board',
          board: guestDeck,
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Kartlar dağıtıldı, başla/i)).toBeInTheDocument();
      expect(screen.getAllByRole('button')).toHaveLength(17);
    });

    expect(socketService.getSocket).toHaveBeenCalled();
  });
});
