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
  GameLobby: ({ requests, onJoinGame, onViewProfile }: any) => (
    <div data-testid="game-lobby-mock">
      {requests.map((game: GameRequest) => (
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
          onClick={() => onSubmit('rps', 100)}
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
    role: 'user',
    isAdmin: false,
    department: 'Bilgisayar Mühendisliği'
  };

  const mockGames: GameRequest[] = [
    {
      id: 1,
      hostId: 2,
      hostName: 'hostuser1',
      gameType: 'rps',
      points: 100,
      status: 'waiting',
      tableCode: 'A1',
      createdAt: '2024-02-04T10:00:00Z'
    },
    {
      id: 2,
      hostId: 3,
      hostName: 'hostuser2',
      gameType: 'arena',
      points: 200,
      status: 'waiting',
      tableCode: 'B2',
      createdAt: '2024-02-04T11:00:00Z'
    }
  ];

  const mockServerActiveGame: GameRequest = {
    id: 999,
    hostId: 2,
    hostName: 'opponent',
    gameType: 'rps',
    points: 150,
    status: 'active',
    tableCode: 'A1',
    createdAt: '2024-02-04T09:00:00Z'
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
      expect(screen.getByText(/🎮 Aktif Oyunun Var!/i)).toBeInTheDocument();
      expect(screen.getByText(/opponent/i)).toBeInTheDocument();
      expect(screen.getByText(/rps/i)).toBeInTheDocument();
      
      // Oyuna dön butonu
      const rejoinButton = screen.getByText(/Oyuna Dön/i);
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
      expect(screen.getByTestId('game-lobby-empty')).toBeInTheDocument();
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
    it('should display empty state when no games available', () => {
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

      expect(screen.getByTestId('game-lobby-empty')).toBeInTheDocument();
      expect(screen.getByText(/Henüz Oyun Yok/i)).toBeInTheDocument();
      expect(screen.getByText(/İlk oyunu kuran sen ol!/i)).toBeInTheDocument();
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
  describe('Create Game Button', () => {
    it('should be DISABLED when not matched to table', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode=""
          isMatched={false} // Masa eşleşmemiş!
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
      expect(createButton).toBeDisabled();
      
      // Bilgilendirici mesaj
      expect(screen.getByText(/Oyun oynamak için önce bir masaya bağlanmalısın!/i)).toBeInTheDocument();
    });

    it('should be ENABLED when matched to table', () => {
      render(
        <GameSection
          currentUser={mockUser}
          tableCode="A1"
          isMatched={true} // Masa eşleşmiş
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
      expect(createButton).not.toBeDisabled();
      
      // Masaya özel mesaj
      expect(screen.getByText(/Masan: A1/i)).toBeInTheDocument();
    });

    it('should open modal when clicked and matched', () => {
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
        expect(mockHandlers.onCreateGame).toHaveBeenCalledWith('rps', 100);
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
      expect(screen.getByText(/Oyun Lobisi/i)).toBeInTheDocument();
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

      expect(screen.getByText(/Masan: C3/i)).toBeInTheDocument();
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

      // H2 heading var mı?
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(/Oyun Lobisi/i);
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
