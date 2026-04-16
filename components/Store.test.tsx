import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Store } from './Store';
import type { User } from '../types';
import { api } from '../lib/api';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
  },
}));

jest.mock('../lib/api', () => ({
  api: {
    store: {
      items: jest.fn(),
      inventory: jest.fn(),
      buy: jest.fn(),
    },
  },
}));

describe('Store', () => {
  const mockUser: User = {
    id: 7,
    username: 'emin',
    email: 'emin@example.com',
    points: 300,
    wins: 10,
    gamesPlayed: 15,
    role: 'user',
    isAdmin: false,
  };

  const mockItems = [
    {
      id: 1,
      title: 'Altin Cerceve',
      code: 'FRAME_GOLD',
      price: 150,
      type: 'frame' as const,
      description: 'Profiline altin bir cerceve ekler.',
    },
    {
      id: 2,
      title: 'Efsane Unvan',
      code: 'TITLE_LEGEND',
      price: 450,
      type: 'title' as const,
      description: 'Lobide efsane gorunumu verir.',
    },
  ];

  const mockInventory = [
    {
      id: 31,
      user_id: 7,
      item_id: 99,
      item_title: 'Mevcut Rozet',
      code: 'BADGE_EXISTING',
      is_used: true,
    },
  ];

  const toast = {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  };

  const updateUser = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (api.store.items as jest.Mock).mockResolvedValue({
      success: true,
      items: mockItems,
    });
    (api.store.inventory as jest.Mock).mockResolvedValue({
      success: true,
      inventory: mockInventory,
    });
    (api.store.buy as jest.Mock).mockResolvedValue({
      success: true,
      message: 'OK',
      remainingPoints: 150,
      inventoryItem: {
        id: 32,
        user_id: 7,
        item_id: 1,
        item_title: 'Altin Cerceve',
        code: 'FRAME_GOLD',
        is_used: false,
      },
    });
  });

  const renderStore = (user: User | null = mockUser) =>
    render(
      <Store
        user={user}
        updateUser={updateUser}
        onShowToast={toast}
      />
    );

  it('shows loading state before store data resolves', () => {
    renderStore();

    expect(screen.getByText('MARKET_AĞI_TARANIYOR...')).toBeInTheDocument();
  });

  it('loads items and inventory for signed-in users', async () => {
    renderStore();

    expect(await screen.findByText('Siber Pazar')).toBeInTheDocument();
    expect(screen.getByText('Altin Cerceve')).toBeInTheDocument();
    expect(screen.getByText('Efsane Unvan')).toBeInTheDocument();
    expect(screen.getByText(/300/i)).toBeInTheDocument();
    expect(api.store.items).toHaveBeenCalledTimes(1);
    expect(api.store.inventory).toHaveBeenCalledTimes(1);
  });

  it('skips inventory fetch for guests and blocks purchasing', async () => {
    renderStore(null);

    expect(await screen.findByText('Siber Pazar')).toBeInTheDocument();
    expect(api.store.inventory).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'GİRİŞ YAP' })[0]);

    expect(toast.error).toHaveBeenCalledWith('Satın alım için giriş yapmalısınız.');
  });

  it('warns when the user does not have enough points', async () => {
    renderStore({ ...mockUser, points: 100 });

    expect(await screen.findByText('Siber Pazar')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'YETERSİZ BAKİYE' })[0]);

    expect(toast.warning).toHaveBeenCalledWith('Yetersiz Cyber-Creds (Puan)');
    expect(api.store.buy).not.toHaveBeenCalled();
  });

  it('buys an item, updates local points, and marks it as owned', async () => {
    renderStore();

    expect(await screen.findByText('Altin Cerceve')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'SATIN AL' }));

    await waitFor(() => {
      expect(api.store.buy).toHaveBeenCalledWith(1);
    });

    expect(toast.success).toHaveBeenCalledWith('Altin Cerceve başarıyla satın alındı!');
    expect(updateUser).toHaveBeenCalledWith({ points: 150 });
    await waitFor(() => {
      expect(screen.getByText(/SATIN ALINDI/i, { selector: 'span' })).toBeInTheDocument();
    });
  });

  it('shows a backend error message when purchase fails without throwing', async () => {
    (api.store.buy as jest.Mock).mockResolvedValueOnce({
      success: false,
      message: 'Bu urune zaten sahipsiniz',
    });

    renderStore();

    expect(await screen.findByText('Altin Cerceve')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'SATIN AL' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Bu urune zaten sahipsiniz');
    });
  });

  it('handles fetch failures gracefully', async () => {
    (api.store.items as jest.Mock).mockRejectedValueOnce(new Error('network'));

    renderStore();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Mağaza yüklenemedi. Lütfen tekrar deneyin.');
    });
  });
});
