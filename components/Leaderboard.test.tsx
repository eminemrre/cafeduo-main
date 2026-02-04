/**
 * Leaderboard Component Tests
 * 
 * @description User ranking and leaderboard tests
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Leaderboard } from './Leaderboard';

// Mock constants
jest.mock('../constants', () => ({
  PAU_DEPARTMENTS: ['Bilgisayar Mühendisliği', 'Elektrik Mühendisliği', 'Makine Mühendisliği'],
}));

global.fetch = jest.fn();

describe('Leaderboard', () => {
  const mockUsers = [
    {
      id: 1,
      username: 'oyuncu1',
      points: 5000,
      wins: 25,
      gamesPlayed: 50,
      department: 'Bilgisayar Mühendisliği',
    },
    {
      id: 2,
      username: 'oyuncu2',
      points: 3500,
      wins: 18,
      gamesPlayed: 40,
      department: 'Elektrik Mühendisliği',
    },
    {
      id: 3,
      username: 'oyuncu3',
      points: 2000,
      wins: 10,
      gamesPlayed: 30,
      department: 'Makine Mühendisliği',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders leaderboard title', () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ json: async () => [] });
    
    render(<Leaderboard />);
    
    expect(screen.getByText('LİDERLİK TABLOSU')).toBeInTheDocument();
  });

  it('renders filter buttons', () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ json: async () => [] });
    
    render(<Leaderboard />);
    
    expect(screen.getByText('GENEL')).toBeInTheDocument();
    expect(screen.getByText('BÖLÜM')).toBeInTheDocument();
  });

  it('displays loading state', async () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
    
    render(<Leaderboard />);
    
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
  });

  it('renders user list with correct data', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => mockUsers,
    });

    render(<Leaderboard />);

    await waitFor(() => {
      expect(screen.getByText('oyuncu1')).toBeInTheDocument();
      expect(screen.getByText('oyuncu2')).toBeInTheDocument();
      expect(screen.getByText('oyuncu3')).toBeInTheDocument();
    });
  });

  it('displays points in correct format', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => [mockUsers[0]],
    });

    render(<Leaderboard />);

    await waitFor(() => {
      // toLocaleString() sonucu locale'e göre değişebilir
      // Türkçe: 5.000, İngilizce: 5,000
      const pointsCell = screen.getByText(/5[.,]000/);
      expect(pointsCell).toBeInTheDocument();
      expect(pointsCell).toHaveClass('text-yellow-500');
    });
  });

  it('shows empty state when no users', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => [],
    });

    render(<Leaderboard />);

    await waitFor(() => {
      expect(screen.getByText('Henüz veri yok.')).toBeInTheDocument();
    });
  });

  it('fetches general leaderboard by default', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: async () => [],
    });

    render(<Leaderboard />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('type=general')
      );
    });
  });

  it('switches to department filter and shows dropdown', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => [] }) // initial load
      .mockResolvedValueOnce({ json: async () => [] }); // after filter change

    render(<Leaderboard />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('BÖLÜM'));

    await waitFor(() => {
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('type=department')
      );
    });

    // Department dropdown should be visible
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('changes department and re-fetches', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ json: async () => [] })
      .mockResolvedValueOnce({ json: async () => [] })
      .mockResolvedValueOnce({ json: async () => [] });

    render(<Leaderboard />);

    // Wait for initial load
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    // Switch to department filter
    fireEvent.click(screen.getByText('BÖLÜM'));
    
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));

    // Change department
    const dropdown = screen.getByRole('combobox');
    fireEvent.change(dropdown, { target: { value: 'Elektrik Mühendisliği' } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent('Elektrik Mühendisliği'))
      );
    });
  });

  it('renders table headers correctly', () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ json: async () => [] });
    
    render(<Leaderboard />);
    
    // Table headers
    expect(screen.getByText('Sıra')).toBeInTheDocument();
    expect(screen.getByText('Kullanıcı')).toBeInTheDocument();
    expect(screen.getByText('Bölüm')).toBeInTheDocument();
    expect(screen.getByText('Puan')).toBeInTheDocument();
    expect(screen.getByText('Galibiyet')).toBeInTheDocument();
  });

  it('handles fetch errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    render(<Leaderboard />);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });
});
