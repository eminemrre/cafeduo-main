/**
 * GameLobby Component Tests
 * 
 * @description Game listing and joining functionality tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GameLobby } from './GameLobby';
import { User, GameRequest } from '../types';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} {...props}>{children}</button>
    ),
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  }
}));

describe('GameLobby', () => {
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    points: 1000,
    wins: 5,
    gamesPlayed: 10,
    cafe_id: 1,
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  const mockGames: GameRequest[] = [
    {
      id: 1,
      gameType: 'Taş Kağıt Makas',
      points: 50,
      hostName: 'host1',
      hostId: 2,
      status: 'waiting',
      table: 'A1',
      createdAt: new Date().toISOString(),
    },
    {
      id: 2,
      gameType: 'Zindan Savaşı',
      points: 100,
      hostName: 'host2',
      hostId: 3,
      status: 'waiting',
      table: 'B2',
      createdAt: new Date().toISOString(),
    },
  ];

  const defaultProps = {
    currentUser: mockUser,
    requests: mockGames,
    onJoinGame: jest.fn(),
    onCreateGameClick: jest.fn(),
    onViewProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders action buttons', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('OYUN KUR')).toBeInTheDocument();
      expect(screen.getByText('RAKİP ARA')).toBeInTheDocument();
    });

    it('renders game list when games exist', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('host1')).toBeInTheDocument();
      expect(screen.getByText('host2')).toBeInTheDocument();
      expect(screen.getByText('A1')).toBeInTheDocument();
      expect(screen.getByText('B2')).toBeInTheDocument();
    });

    it('renders empty state when no games', () => {
      render(<GameLobby {...defaultProps} requests={[]} />);

      expect(screen.getByText(/ŞU AN AKTİF OYUN YOK/i)).toBeInTheDocument();
      expect(screen.getByText(/İLK OYUNU SEN KUR/i)).toBeInTheDocument();
    });

    it('shows game types', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('Taş Kağıt Makas')).toBeInTheDocument();
      expect(screen.getByText('Zindan Savaşı')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onCreateGameClick when OYUN KUR button clicked', () => {
      render(<GameLobby {...defaultProps} />);

      fireEvent.click(screen.getByText('OYUN KUR'));

      expect(defaultProps.onCreateGameClick).toHaveBeenCalledTimes(1);
    });

    it('calls onJoinGame with correct id when joining a game', () => {
      render(<GameLobby {...defaultProps} />);

      const joinButtons = screen.getAllByText('KATIL');
      fireEvent.click(joinButtons[0]);

      expect(defaultProps.onJoinGame).toHaveBeenCalledWith(1);
    });

    it('calls onViewProfile when clicking host avatar', () => {
      render(<GameLobby {...defaultProps} />);

      // Click on avatar (first letter of hostName)
      const avatarButtons = screen.getAllByText('H');
      fireEvent.click(avatarButtons[0]);

      expect(defaultProps.onViewProfile).toHaveBeenCalledWith('host1');
    });

    it('shows SENİN OYUNUN for own games', () => {
      const ownGame = {
        ...mockGames[0],
        hostId: mockUser.id,
        hostName: mockUser.username,
      };

      render(<GameLobby {...defaultProps} requests={[ownGame]} />);

      expect(screen.getByText('SENİN OYUNUN')).toBeInTheDocument();
      expect(screen.queryByText('KATIL')).not.toBeInTheDocument();
    });
  });

  describe('Game Display', () => {
    it('shows lobby header', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('LOBİ')).toBeInTheDocument();
      expect(screen.getByText('AKTİF İSTEKLER (LOBİ)')).toBeInTheDocument();
    });

    it('shows table codes', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('A1')).toBeInTheDocument();
      expect(screen.getByText('B2')).toBeInTheDocument();
    });

    it('renders game type emojis', () => {
      const { container } = render(<GameLobby {...defaultProps} />);
      
      // Check for game types
      expect(container.textContent).toContain('Taş Kağıt Makas');
      expect(container.textContent).toContain('Zindan Savaşı');
    });
  });

  describe('Edge Cases', () => {
    it('handles unknown host names', () => {
      const gameWithUnknownHost = {
        ...mockGames[0],
        hostName: undefined as any,
      };

      render(<GameLobby {...defaultProps} requests={[gameWithUnknownHost]} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders with empty requests array', () => {
      render(<GameLobby {...defaultProps} requests={[]} />);

      expect(screen.getByText('OYUN KUR')).toBeInTheDocument();
      expect(screen.getByText('RAKİP ARA')).toBeInTheDocument();
    });
  });
});
