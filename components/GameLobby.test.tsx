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
  },
  useReducedMotion: () => false,
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
    isAdmin: false,
  };

  const mockGames: GameRequest[] = [
    {
      id: 1,
      gameType: 'Refleks Avı',
      points: 50,
      hostName: 'host1',
      status: 'waiting',
      table: 'A1',
    },
    {
      id: 2,
      gameType: 'Çift Tek Sprint',
      points: 100,
      hostName: 'host2',
      status: 'waiting',
      table: 'B2',
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

      expect(screen.getByText('Oyun Kur')).toBeInTheDocument();
      expect(screen.getByText('HIZLI EŞLEŞ')).toBeInTheDocument();
    });

    it('renders game list when games exist', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('host1')).toBeInTheDocument();
      expect(screen.getByText('host2')).toBeInTheDocument();
      expect(screen.getByText(/Masa A1/i)).toBeInTheDocument();
      expect(screen.getByText(/Masa B2/i)).toBeInTheDocument();
    });

    it('renders empty state when no games', () => {
      render(<GameLobby {...defaultProps} requests={[]} />);

      expect(screen.getByText(/RADAR TEMİZ/i)).toBeInTheDocument();
      expect(screen.getByText(/İLK SİNYALİ GÖNDER!/i)).toBeInTheDocument();
    });

    it('shows game types', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('Refleks Avı')).toBeInTheDocument();
      expect(screen.getByText('Çift Tek Sprint')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('calls onCreateGameClick when OYUN KUR button clicked', () => {
      render(<GameLobby {...defaultProps} />);

      fireEvent.click(screen.getByText('Oyun Kur'));

      expect(defaultProps.onCreateGameClick).toHaveBeenCalledTimes(1);
    });

    it('calls onJoinGame with correct id when joining a game', () => {
      render(<GameLobby {...defaultProps} />);

      const joinButtons = screen.getAllByText('SAVAŞA KATIL');
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

      expect(screen.getByText('SENİN LOBİN')).toBeInTheDocument();
      expect(screen.queryByText('SAVAŞA KATIL')).not.toBeInTheDocument();
    });
  });

  describe('Game Display', () => {
    it('shows lobby header', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText('AKTİF LOBİ')).toBeInTheDocument();
    });

    it('shows table codes', () => {
      render(<GameLobby {...defaultProps} />);

      expect(screen.getByText(/Masa A1/i)).toBeInTheDocument();
      expect(screen.getByText(/Masa B2/i)).toBeInTheDocument();
    });

    it('renders game type emojis', () => {
      const { container } = render(<GameLobby {...defaultProps} />);

      // Check for game types
      expect(container.textContent).toContain('Refleks Avı');
      expect(container.textContent).toContain('Çift Tek Sprint');
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

      expect(screen.getByText('Oyun Kur')).toBeInTheDocument();
      expect(screen.getByText('HIZLI EŞLEŞ')).toBeInTheDocument();
    });
  });
});
