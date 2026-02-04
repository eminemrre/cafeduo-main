import { renderHook, act, waitFor } from '@testing-library/react';
import { useRewards } from './useRewards';

// Mock api
jest.mock('../lib/api', () => ({
  api: {
    rewards: {
      list: jest.fn(),
    },
    shop: {
      buy: jest.fn(),
      inventory: jest.fn(),
    }
  }
}));

import { api } from '../lib/api';

describe('useRewards', () => {
  const mockUser = {
    id: 1,
    username: 'testuser',
    points: 500,
    email: 'test@test.com',
    isAdmin: false,
    role: 'user',
    wins: 0,
    gamesPlayed: 0
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initial state and fetches on mount', async () => {
    const mockRewards = [
      { id: 1, title: 'Kahve', cost: 100, description: 'Kahve', icon: 'coffee' }
    ];
    const mockInventory = [
      { id: 1, itemId: 1, title: 'Kahve', code: 'ABC123', redeemedAt: new Date().toISOString(), isUsed: false }
    ];

    (api.rewards.list as jest.Mock).mockResolvedValue(mockRewards);
    (api.shop.inventory as jest.Mock).mockResolvedValue(mockInventory);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    // Initial state
    expect(result.current.rewards).toEqual([]);
    expect(result.current.inventory).toEqual([]);
    expect(result.current.activeTab).toBe('shop');

    // Wait for fetch
    await waitFor(() => {
      expect(api.rewards.list).toHaveBeenCalled();
      expect(api.shop.inventory).toHaveBeenCalledWith(mockUser.id);
    });
  });

  it('switches between shop and inventory tabs', () => {
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    expect(result.current.activeTab).toBe('shop');

    act(() => {
      result.current.setActiveTab('inventory');
    });

    expect(result.current.activeTab).toBe('inventory');
  });

  it('buyReward - success', async () => {
    const mockResponse = {
      success: true,
      newPoints: 400,
      reward: { code: 'COFFEE123' }
    };

    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);
    (api.shop.buy as jest.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    await waitFor(() => expect(api.rewards.list).toHaveBeenCalled());

    const reward = { id: 1, title: 'Kahve', cost: 100, description: 'Kahve', icon: 'coffee' };
    
    const buyResult = await act(async () => {
      return await result.current.buyReward(reward);
    });

    expect(api.shop.buy).toHaveBeenCalledWith(mockUser.id, reward.id);
    expect(buyResult.success).toBe(true);
    expect(buyResult.newPoints).toBe(400);
  });

  it('buyReward - insufficient points', async () => {
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    await waitFor(() => expect(api.rewards.list).toHaveBeenCalled());

    const expensiveReward = { id: 1, title: 'Pahalı', cost: 1000, description: 'Pahalı', icon: 'diamond' };

    await expect(
      act(async () => {
        await result.current.buyReward(expensiveReward);
      })
    ).rejects.toThrow('Yetersiz puan');
  });

  it('buyReward - API error', async () => {
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);
    (api.shop.buy as jest.Mock).mockRejectedValue(new Error('Stokta yok'));

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    await waitFor(() => expect(api.rewards.list).toHaveBeenCalled());

    const reward = { id: 1, title: 'Kahve', cost: 100, description: 'Kahve', icon: 'coffee' };

    await expect(
      act(async () => {
        await result.current.buyReward(reward);
      })
    ).rejects.toThrow('Stokta yok');
  });

  it('canAfford returns correct boolean', async () => {
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    await waitFor(() => expect(api.rewards.list).toHaveBeenCalled());

    expect(result.current.canAfford(100)).toBe(true);
    expect(result.current.canAfford(500)).toBe(true);
    expect(result.current.canAfford(501)).toBe(false);
  });

  it('refetchRewards reloads rewards', async () => {
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    await waitFor(() => expect(api.rewards.list).toHaveBeenCalled());
    
    jest.clearAllMocks();

    await act(async () => {
      await result.current.refetchRewards();
    });

    expect(api.rewards.list).toHaveBeenCalledTimes(1);
  });

  it('refetchInventory reloads inventory', async () => {
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.shop.inventory as jest.Mock).mockResolvedValue([]);

    const { result } = renderHook(() => useRewards({ currentUser: mockUser }));

    await waitFor(() => expect(api.shop.inventory).toHaveBeenCalled());
    
    jest.clearAllMocks();

    await act(async () => {
      await result.current.refetchInventory();
    });

    expect(api.shop.inventory).toHaveBeenCalledWith(mockUser.id);
  });
});
