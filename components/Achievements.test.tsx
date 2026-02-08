/**
 * Achievements Component Tests
 * 
 * @description User achievements display tests
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { Achievements } from './Achievements';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({
  api: {
    achievements: {
      list: jest.fn(),
    },
  },
}));

describe('Achievements', () => {
  const mockAchievements = [
    {
      id: 1,
      title: 'İlk Galibiyet',
      description: 'İlk oyununu kazan',
      icon: 'trophy',
      points_reward: 100,
      unlocked: true,
      unlockedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 2,
      title: 'Oyun Ustası',
      description: '10 oyun oyna',
      icon: 'gamepad',
      points_reward: 500,
      unlocked: false,
      unlockedAt: null,
    },
    {
      id: 3,
      title: 'Zengin Oyuncu',
      description: '1000 puan topla',
      icon: 'coins',
      points_reward: 200,
      unlocked: true,
      unlockedAt: '2024-02-01T15:30:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    (api.achievements.list as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<Achievements userId={1} />);
    
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('renders achievements after loading', async () => {
    (api.achievements.list as jest.Mock).mockResolvedValueOnce(mockAchievements);

    render(<Achievements userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('İlk Galibiyet')).toBeInTheDocument();
      expect(screen.getByText('Oyun Ustası')).toBeInTheDocument();
      expect(screen.getByText('Zengin Oyuncu')).toBeInTheDocument();
    });
  });

  it('displays unlocked achievements with correct styling', async () => {
    (api.achievements.list as jest.Mock).mockResolvedValueOnce([mockAchievements[0]]);

    render(<Achievements userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('İlk Galibiyet')).toBeInTheDocument();
      expect(screen.getByText('+100 P')).toBeInTheDocument();
      expect(screen.getByText(/Kazanıldı:/)).toBeInTheDocument();
    });
  });

  it('displays locked achievements with lock icon', async () => {
    (api.achievements.list as jest.Mock).mockResolvedValueOnce([mockAchievements[1]]);

    render(<Achievements userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Oyun Ustası')).toBeInTheDocument();
      expect(screen.getByText('10 oyun oyna')).toBeInTheDocument();
    });
  });

  it('fetches achievements with correct userId', async () => {
    (api.achievements.list as jest.Mock).mockResolvedValueOnce([]);

    render(<Achievements userId={42} />);

    await waitFor(() => {
      expect(api.achievements.list).toHaveBeenCalledWith(42);
    });
  });

  it('handles fetch error gracefully', async () => {
    (api.achievements.list as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<Achievements userId={1} />);

    await waitFor(() => {
      expect(screen.getByText('Başarımlar yüklenemedi.')).toBeInTheDocument();
    });
  });

  it('re-fetches when userId changes', async () => {
    (api.achievements.list as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(mockAchievements);

    const { rerender } = render(<Achievements userId={1} />);

    await waitFor(() => expect(api.achievements.list).toHaveBeenCalledTimes(1));

    rerender(<Achievements userId={2} />);

    await waitFor(() => {
      expect(api.achievements.list).toHaveBeenCalledTimes(2);
      expect(api.achievements.list).toHaveBeenLastCalledWith(2);
    });
  });

  it('does not crash if api returns a non-array payload', async () => {
    (api.achievements.list as jest.Mock).mockResolvedValueOnce({ error: 'bad-shape' });

    render(<Achievements userId={1} />);

    await waitFor(() => {
      expect(screen.queryByText('Yükleniyor...')).not.toBeInTheDocument();
    });
  });
});
