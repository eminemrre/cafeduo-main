import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GameSection } from './GameSection';
import { api } from '../../lib/api';
import type { GameHistoryEntry, GameRequest, User } from '../../types';

jest.mock('../../lib/api', () => ({
  api: {
    games: {
      get: jest.fn(),
    },
  },
}));

jest.mock('../GameLobby', () => ({
  GameLobby: ({
    requests,
    onJoinGame,
    onCreateGameClick,
    onQuickJoin,
    quickJoinDisabled,
    quickJoinBusy,
    onViewProfile,
  }: any) => (
    <div data-testid="game-lobby-mock">
      <button data-testid="create-game-button" onClick={onCreateGameClick}>Oyun Kur</button>
      <button
        data-testid="quick-join-button"
        disabled={quickJoinDisabled || quickJoinBusy}
        onClick={() => onQuickJoin()}
      >
        HIZLI EŞLEŞ
      </button>
      {requests?.map((game: GameRequest) => (
        <div key={game.id} data-testid={`game-item-${game.id}`}>
          <span>{game.hostName}</span>
          <button data-testid={`join-${game.id}`} onClick={() => onJoinGame(Number(game.id))}>Katıl</button>
          <button data-testid={`profile-${game.id}`} onClick={() => onViewProfile(game.hostName)}>Profil</button>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('../CreateGameModal', () => ({
  CreateGameModal: ({ isOpen, onClose, onSubmit, maxPoints }: any) =>
    isOpen ? (
      <div data-testid="create-game-modal-mock">
        <span data-testid="modal-max-points">{maxPoints}</span>
        <button data-testid="modal-close" onClick={onClose}>Kapat</button>
        <button data-testid="modal-submit" onClick={() => onSubmit('Refleks Avı', 100)}>Oluştur</button>
      </div>
    ) : null,
}));

jest.mock('../Skeleton', () => ({
  SkeletonGrid: ({ count }: { count: number }) => (
    <div data-testid="skeleton-grid">{Array.from({ length: count }).map((_, index) => <div key={index}>Loading</div>)}</div>
  ),
}));

const mockApiGamesGet = api.games.get as jest.MockedFunction<typeof api.games.get>;

const mockUser: User = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  points: 500,
  wins: 10,
  gamesPlayed: 20,
  role: 'user',
  isAdmin: false,
  department: 'Bilgisayar Mühendisliği',
};

const baseGames: GameRequest[] = [
  {
    id: 1,
    hostName: 'hostuser1',
    gameType: 'Refleks Avı',
    points: 100,
    table: 'MASA05',
    status: 'waiting',
  },
  {
    id: 2,
    hostName: 'hostuser2',
    gameType: 'Ritim Kopyala',
    points: 200,
    table: 'MASA07',
    status: 'waiting',
  },
];

const chessHistoryEntry: GameHistoryEntry = {
  id: 51,
  gameType: 'Retro Satranç',
  points: 100,
  status: 'finished',
  table: 'MASA05',
  opponentName: 'Rakip',
  winner: 'testuser',
  didWin: true,
  createdAt: '2026-03-05T10:00:00.000Z',
  moveCount: 12,
  chessTempo: '5+3',
};

const mockHandlers = () => ({
  onCreateGame: jest.fn().mockResolvedValue(undefined),
  onJoinGame: jest.fn().mockResolvedValue(undefined),
  onCancelGame: jest.fn().mockResolvedValue(undefined),
  onViewProfile: jest.fn(),
  onRejoinGame: jest.fn(),
  setIsCreateModalOpen: jest.fn(),
});

const renderSection = (overrides: Partial<React.ComponentProps<typeof GameSection>> = {}) => {
  const handlers = mockHandlers();
  const props: React.ComponentProps<typeof GameSection> = {
    currentUser: mockUser,
    tableCode: 'MASA05',
    isMatched: true,
    games: baseGames,
    gamesLoading: false,
    gameHistory: [],
    historyLoading: false,
    activeGameId: null,
    serverActiveGame: null,
    isCreateModalOpen: false,
    setIsCreateModalOpen: handlers.setIsCreateModalOpen,
    onCreateGame: handlers.onCreateGame,
    onJoinGame: handlers.onJoinGame,
    onCancelGame: handlers.onCancelGame,
    onViewProfile: handlers.onViewProfile,
    onRejoinGame: handlers.onRejoinGame,
    ...overrides,
  };

  render(
    <GameSection {...props} />
  );

  return props;
};

describe('GameSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGamesGet.mockReset();
  });

  it('shows loading state when games are loading', () => {
    renderSection({ games: [], gamesLoading: true });

    expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument();
  });

  it('shows rejoin banner with guest label when current user is host', () => {
    const handlers = renderSection({
      games: [],
      serverActiveGame: {
        id: 99,
        hostName: 'testuser',
        guestName: 'guest-player',
        gameType: 'Refleks Avı',
        points: 50,
        table: 'MASA05',
        status: 'active',
      },
    });

    expect(screen.getByText(/DEVAM EDEN SAVAŞ/i)).toBeInTheDocument();
    expect(screen.getByText(/guest-player/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /ARENAYA DÖN/i }));
    expect(handlers.onRejoinGame).toHaveBeenCalledTimes(1);
  });

  it('shows host label when current user is not the host', () => {
    renderSection({
      games: [],
      serverActiveGame: {
        id: 100,
        hostName: 'other-host',
        guestName: 'testuser',
        gameType: 'Refleks Avı',
        points: 50,
        table: 'MASA05',
        status: 'active',
      },
    });

    expect(screen.getByText(/other-host/i)).toBeInTheDocument();
  });

  it('quick-joins the same-table waiting game first and forwards profile clicks', async () => {
    const handlers = renderSection({
      games: [
        {
          id: 9,
          hostName: 'testuser',
          gameType: 'Refleks Avı',
          points: 50,
          table: 'MASA05',
          status: 'waiting',
        },
        {
          id: 11,
          hostName: 'same-table-host',
          gameType: 'Refleks Avı',
          points: 75,
          table: 'MASA05',
          status: 'waiting',
        },
        {
          id: 12,
          hostName: 'other-table-host',
          gameType: 'Refleks Avı',
          points: 80,
          table: 'MASA09',
          status: 'waiting',
        },
      ],
    });

    fireEvent.click(screen.getByTestId('quick-join-button'));
    await waitFor(() => {
      expect(handlers.onJoinGame).toHaveBeenCalledWith(11);
    });

    fireEvent.click(screen.getByTestId('profile-11'));
    expect(handlers.onViewProfile).toHaveBeenCalledWith('same-table-host');
  });

  it('disables quick join when user is not matched or there is no candidate', () => {
    const { rerender } = render(
      <GameSection
        currentUser={mockUser}
        tableCode="MASA05"
        isMatched={false}
        games={baseGames}
        gamesLoading={false}
        gameHistory={[]}
        historyLoading={false}
        activeGameId={null}
        serverActiveGame={null}
        isCreateModalOpen={false}
        setIsCreateModalOpen={jest.fn()}
        onCreateGame={jest.fn()}
        onJoinGame={jest.fn()}
        onCancelGame={jest.fn()}
        onViewProfile={jest.fn()}
        onRejoinGame={jest.fn()}
      />
    );

    expect(screen.getByTestId('quick-join-button')).toBeDisabled();

    rerender(
      <GameSection
        currentUser={mockUser}
        tableCode="MASA05"
        isMatched={true}
        games={[{ ...baseGames[0], hostName: 'testuser' }]}
        gamesLoading={false}
        gameHistory={[]}
        historyLoading={false}
        activeGameId={null}
        serverActiveGame={null}
        isCreateModalOpen={false}
        setIsCreateModalOpen={jest.fn()}
        onCreateGame={jest.fn()}
        onJoinGame={jest.fn()}
        onCancelGame={jest.fn()}
        onViewProfile={jest.fn()}
        onRejoinGame={jest.fn()}
      />
    );

    expect(screen.getByTestId('quick-join-button')).toBeDisabled();
  });

  it('keeps quick join disabled while an async join is in flight', async () => {
    let resolveJoin: (() => void) | undefined;
    const handlers = renderSection({
      onJoinGame: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveJoin = resolve;
          })
      ),
    });

    fireEvent.click(screen.getByTestId('quick-join-button'));

    await waitFor(() => {
      expect(screen.getByTestId('quick-join-button')).toBeDisabled();
    });

    fireEvent.click(screen.getByTestId('quick-join-button'));
    expect(handlers.onJoinGame).toHaveBeenCalledTimes(1);

    resolveJoin?.();
    await waitFor(() => {
      expect(screen.getByTestId('quick-join-button')).not.toBeDisabled();
    });
  });

  it('opens and closes the create modal and submits with current max points', async () => {
    const handlers = renderSection({ isCreateModalOpen: true });

    expect(screen.getByTestId('create-game-modal-mock')).toBeInTheDocument();
    expect(screen.getByTestId('modal-max-points')).toHaveTextContent('500');

    fireEvent.click(screen.getByTestId('modal-submit'));
    await waitFor(() => {
      expect(handlers.onCreateGame).toHaveBeenCalledWith('Refleks Avı', 100);
    });

    fireEvent.click(screen.getByTestId('modal-close'));
    expect(handlers.setIsCreateModalOpen).toHaveBeenCalledWith(false);
  });

  it('shows history loading and empty states', () => {
    const { rerender } = render(
      <GameSection
        currentUser={mockUser}
        tableCode="MASA05"
        isMatched={true}
        games={baseGames}
        gamesLoading={false}
        gameHistory={[]}
        historyLoading={true}
        activeGameId={null}
        serverActiveGame={null}
        isCreateModalOpen={false}
        setIsCreateModalOpen={jest.fn()}
        onCreateGame={jest.fn()}
        onJoinGame={jest.fn()}
        onCancelGame={jest.fn()}
        onViewProfile={jest.fn()}
        onRejoinGame={jest.fn()}
      />
    );

    expect(screen.getByText(/Veri çekiliyor/i)).toBeInTheDocument();

    rerender(
      <GameSection
        currentUser={mockUser}
        tableCode="MASA05"
        isMatched={true}
        games={baseGames}
        gamesLoading={false}
        gameHistory={[]}
        historyLoading={false}
        activeGameId={null}
        serverActiveGame={null}
        isCreateModalOpen={false}
        setIsCreateModalOpen={jest.fn()}
        onCreateGame={jest.fn()}
        onJoinGame={jest.fn()}
        onCancelGame={jest.fn()}
        onViewProfile={jest.fn()}
        onRejoinGame={jest.fn()}
      />
    );

    expect(screen.getByText(/SAVAŞ GEÇMİŞİ BULUNAMADI/i)).toBeInTheDocument();
  });

  it('renders chess history details with derived tempo and closes modal', async () => {
    mockApiGamesGet.mockResolvedValue({
      gameState: {
        chess: {
          moveHistory: [
            { from: 'e2', to: 'e4', san: 'e4', spentMs: 1500 },
            { from: 'e7', to: 'e5', san: 'e5', spentMs: 1200 },
          ],
          clock: {
            baseMs: 300000,
            incrementMs: 3000,
          },
        },
      },
    } as any);

    renderSection({ gameHistory: [chessHistoryEntry] });

    fireEvent.click(screen.getByRole('button', { name: /LOGLARI GÖSTER/i }));

    await waitFor(() => {
      expect(mockApiGamesGet).toHaveBeenCalledWith(51);
    });

    expect(screen.getByText(/SİSTEM KAYDI #CHESS/i)).toBeInTheDocument();
    expect(screen.getByText(/001\./i)).toBeInTheDocument();
    expect(screen.getByText(/002\./i)).toBeInTheDocument();
    expect(screen.getByText(/Tempo: 5\+3/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /KAPAT/i }));
    await waitFor(() => {
      expect(screen.queryByText(/SİSTEM KAYDI #CHESS/i)).not.toBeInTheDocument();
    });
  });

  it('shows chess history error and empty move states', async () => {
    mockApiGamesGet.mockRejectedValueOnce(new Error('api failed'));

    const { rerender } = render(
      <GameSection
        currentUser={mockUser}
        tableCode="MASA05"
        isMatched={true}
        games={baseGames}
        gamesLoading={false}
        gameHistory={[chessHistoryEntry]}
        historyLoading={false}
        activeGameId={null}
        serverActiveGame={null}
        isCreateModalOpen={false}
        setIsCreateModalOpen={jest.fn()}
        onCreateGame={jest.fn()}
        onJoinGame={jest.fn()}
        onCancelGame={jest.fn()}
        onViewProfile={jest.fn()}
        onRejoinGame={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /LOGLARI GÖSTER/i }));
    await waitFor(() => {
      expect(screen.getByText(/api failed/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /KAPAT/i }));

    mockApiGamesGet.mockResolvedValueOnce({
      gameState: {
        chess: {
          moveHistory: [],
        },
      },
    } as any);

    rerender(
      <GameSection
        currentUser={mockUser}
        tableCode="MASA05"
        isMatched={true}
        games={baseGames}
        gamesLoading={false}
        gameHistory={[chessHistoryEntry]}
        historyLoading={false}
        activeGameId={null}
        serverActiveGame={null}
        isCreateModalOpen={false}
        setIsCreateModalOpen={jest.fn()}
        onCreateGame={jest.fn()}
        onJoinGame={jest.fn()}
        onCancelGame={jest.fn()}
        onViewProfile={jest.fn()}
        onRejoinGame={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /LOGLARI GÖSTER/i }));
    await waitFor(() => {
      expect(screen.getByText(/ANOMALİ: LOKASYON VERİSİ YOK/i)).toBeInTheDocument();
    });
  });
});
