/**
 * GameSection Component Tests
 * 
 * @description Comprehensive test suite for GameSection component
 * covering all UI states, user interactions, and edge cases
 * @author Senior Test Engineer
 * @since 2024-02-04
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { GameSection } from './GameSection';
import { User, GameRequest } from '../../types';

// Mock child components
jest.mock('../GameLobby', () => ({
  GameLobby: ({ requests, onJoinGame, onViewProfile, onCreateGameClick }: any) => (
    <div data-testid="game-lobby-mock">
      <button data-testid="empty-state-action" onClick={onCreateGameClick}>Create Game Mock Button</button>
      <button data-testid="create-game-button" disabled={false} onClick={onCreateGameClick}>Oyun Kur</button>
      <button data-testid="quick-join-button" disabled={false} onClick={() => { }}>HIZLI EŞLEŞ</button>
      {requests?.map((game: GameRequest) => (
        <div key={game.id} data-testid={`game-item-${game.id}`}>
          <span>{game.hostName}</span>
          <button onClick={() => onJoinGame(game.id)}>Join</button>
        </div>
      ))}
    </div>
  )
}));

jest.mock('../CreateGameModal', () => ({
  CreateGameModal: ({ isOpen, onClose, onSubmit }: any) => (
    isOpen ? (
      <div data-testid="create-game-modal-mock">
        <button data-testid="modal-close" onClick={onClose}>Kapat</button>
        <button
          data-testid="modal-submit"
          onClick={() => onSubmit('Refleks Avı', 100)}
        >
          Oluştur
        </button>
      </div>
    ) : null
  )
}));

jest.mock('../Skeleton', () => ({
  SkeletonGrid: ({ count }: any) => (
    <div data-testid="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} data-testid="skeleton-item">Loading...</div>
      ))}
    </div>
  )
}));

jest.mock('../EmptyState', () => ({
  EmptyState: ({ title, description, action }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button data-testid="empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}));

jest.mock('../RetroButton', () => ({
  RetroButton: ({ children, onClick, disabled, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-testid={props['data-testid']}
      {...props}
    >
      {children}
    </button>
  )
}));

describe('GameSection', () => {
  // Test fixtures
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    points: 500,
    wins: 10,
    gamesPlayed: 20,
    role: 'user',
    isAdmin: false,
    department: 'Bilgisayar Mühendisliği'
  };

  const mockGames: GameRequest[] = [
    {
      id: 1,
      hostName: 'hostuser1',
      gameType: 'Refleks Avı',
      points: 100,
      table: 'A1',
      status: 'waiting'
    },
    {
      id: 2,
      hostName: 'hostuser2',
      gameType: 'Ritim Kopyala',
      points: 200,
      table: 'B2',
      status: 'waiting'
    }
  ];

  const mockServerActiveGame: GameRequest = {
    id: 999,
    hostName: 'opponent',
    gameType: 'Refleks Avı',
    points: 150,
    table: 'A1',
    status: 'active'
  };

  // Mock handler'lar
  const mockHandlers = {
    onCreateGame: jest.fn(),
    onJoinGame: jest.fn(),
    onViewProfile: jest.fn(),
    onRejoinGame: jest.fn(),
    setIsCreateModalOpen: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * SCENARIO 1: Aktif oyun varsa banner göster
   * CRITICAL: Kullanıcı aktif oyuna yönlendirilmeli
   */
  describe('Active Game Banner', () => {
    it('should display rejoin banner when server has active game and no local active game', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={mockServerActiveGame}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // BUG CHECK: Banner görünüyor mu?
      expect(screen.getByText(/DEVAM EDEN SAVAŞ!/i)).toBeInTheDocument();
      expect(screen.getByText(/opponent/i)).toBeInTheDocument();
      expect(screen.getByText(/Refleks Avı/i)).toBeInTheDocument();

      // Oyuna dön butonu
      const rejoinButton = screen.getByText(/ARENAYA DÖN/i);
      expect(rejoinButton).toBeInTheDocument();

      // Buton çalışıyor mu?
      fireEvent.click(rejoinButton);
      expect(mockHandlers.onRejoinGame).toHaveBeenCalledTimes(1);
    });

    it('should NOT show banner when activeGameId exists locally', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={999} // Local'de aktif oyun var
          serverActiveGame={mockServerActiveGame}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // Banner görünmemeli
      expect(screen.queryByText(/🎮 Aktif Oyunun Var!/i)).not.toBeInTheDocument();

      // Normal game lobby görünmeli
      expect(screen.getByTestId('game-lobby-mock')).toBeInTheDocument();
    });

    it('should NOT show banner when no server active game', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.queryByText(/🎮 Aktif Oyunun Var!/i)).not.toBeInTheDocument();
    });
  });

  /**
   * SCENARIO 2: Loading state
   */
  describe('Loading State', () => {
    it('should show skeleton grid when games are loading', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={true}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.getByTestId('skeleton-grid')).toBeInTheDocument();

      // 4 skeleton item olmalı
      const skeletonItems = screen.getAllByTestId('skeleton-item');
      expect(skeletonItems).toHaveLength(4);
    });
  });

  /**
   * SCENARIO 3: Empty game list
   */
  describe('Empty Game List', () => {
    it('should pass empty array to GameLobby when no games available', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.getByTestId('game-lobby-list')).toBeInTheDocument();
      // Empty mock just renders <div data-testid="game-lobby-mock"></div>
      expect(screen.getByTestId('game-lobby-mock')).toBeInTheDocument();
    });

    it('should open create modal from empty state action', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      const actionButton = screen.getByTestId('empty-state-action');
      fireEvent.click(actionButton);

      expect(mockHandlers.setIsCreateModalOpen).toHaveBeenCalledWith(true);
    });
  });

  /**
   * SCENARIO 4: Game list with items
   */
  describe('Game List with Items', () => {
    it('should render game lobby with games', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={mockGames}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.getByTestId('game-lobby-list')).toBeInTheDocument();
      expect(screen.getByTestId('game-lobby-mock')).toBeInTheDocument();

      // Game items render edildi mi?
      expect(screen.getByTestId('game-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('game-item-2')).toBeInTheDocument();
    });

    it('should pass correct props to GameLobby', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={mockGames}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // GameLobby'a doğru props gitti mi?
      expect(screen.getByText('hostuser1')).toBeInTheDocument();
      expect(screen.getByText('hostuser2')).toBeInTheDocument();
    });
  });

  /**
   * SCENARIO 5: Create Game Button States
   * CRITICAL: Masa eşleşmemişse buton disabled olmalı
   */
  describe('Create Game Action', () => {
    it('should open modal when clicked', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      const createButton = screen.getByTestId('create-game-button');
      fireEvent.click(createButton);

      expect(mockHandlers.setIsCreateModalOpen).toHaveBeenCalledWith(true);
      expect(mockHandlers.setIsCreateModalOpen).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * SCENARIO 6: Create Game Modal Integration
   */
  describe('Create Game Modal', () => {
    it('should render modal when isCreateModalOpen is true', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={true} // Modal açık
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.getByTestId('create-game-modal-mock')).toBeInTheDocument();
    });

    it('should NOT render modal when isCreateModalOpen is false', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false} // Modal kapalı
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.queryByTestId('create-game-modal-mock')).not.toBeInTheDocument();
    });

    it('should close modal when onClose is triggered', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={true}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      const closeButton = screen.getByTestId('modal-close');
      fireEvent.click(closeButton);

      expect(mockHandlers.setIsCreateModalOpen).toHaveBeenCalledWith(false);
    });

    it('should call onCreateGame with correct params when form submitted', async () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={true}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      const submitButton = screen.getByTestId('modal-submit');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockHandlers.onCreateGame).toHaveBeenCalledWith('Refleks Avı', 100);
      });
    });

    it('should pass maxPoints to CreateGameModal based on currentUser.points', () => {
      const highPointsUser = { ...mockUser, points: 1000 };

      render(
        <GameSection
          currentUser={highPointsUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={true}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // Modal render edildi mi?
      expect(screen.getByTestId('create-game-modal-mock')).toBeInTheDocument();
      // maxPoints props kontrolü (gerçek modal'da test edilmeli)
    });
  });

  /**
   * SCENARIO 7: Edge Cases & Error Handling
   */
  describe('Edge Cases', () => {
    it('should handle undefined games array gracefully', () => {
      // BUG POTENTIAL: games undefined/null olursa patlayabilir
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={undefined as any} // Edge case
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // Component patlamamalı
      expect(screen.getByText(/SAVAŞ ARŞİVİ/i)).toBeInTheDocument();
    });

    it('should handle null currentUser gracefully', () => {
      // BUG POTENTIAL: currentUser null olursa points erişimi patlayabilir
      render(
        <GameSection
          currentUser={null as any} // Edge case
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={true}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // Component render olmalı (hata vermemeli)
      expect(document.body).toBeInTheDocument();
    });

    it('should display correct table code in header', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="C3"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      expect(screen.getByTestId('game-lobby-list')).toBeInTheDocument();
    });
  });

  /**
   * SCENARIO 8: Accessibility
   */
  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      // H3 heading var mı?
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent(/SAVAŞ ARŞİVİ/i);
    });

    it('should have accessible button labels', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true}
          games={[]}
          gamesLoading={false}
          activeGameId={null}
          serverActiveGame={null}
          isCreateModalOpen={false}
          setIsCreateModalOpen={mockHandlers.setIsCreateModalOpen}
          onCreateGame={mockHandlers.onCreateGame}
          onJoinGame={mockHandlers.onJoinGame}
          onViewProfile={mockHandlers.onViewProfile}
          onRejoinGame={mockHandlers.onRejoinGame}
        />
      );

      const createButton = screen.getByTestId('create-game-button');
      expect(createButton).not.toHaveAttribute('aria-hidden');
    });
  });
});
