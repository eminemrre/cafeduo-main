import { act, renderHook, waitFor } from '@testing-library/react';
import { useCafeAdmin } from './useCafeAdmin';
import { api } from '../lib/api';
import type { User } from '../types';

jest.mock('../lib/api', () => ({
  api: {
    cafes: {
      list: jest.fn(),
      updatePin: jest.fn(),
    },
    rewards: {
      list: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    coupons: {
      use: jest.fn(),
    },
  },
}));

describe('useCafeAdmin', () => {
  const baseUser: User = {
    id: 10,
    username: 'cafeAdmin',
    email: 'admin@cafe.com',
    points: 1000,
    wins: 5,
    gamesPlayed: 20,
    role: 'cafe_admin',
    isAdmin: false,
    cafe_id: 1,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.rewards.list as jest.Mock).mockResolvedValue([]);
    (api.cafes.list as jest.Mock).mockResolvedValue([{ id: 1, name: 'Cafe', daily_pin: '1234' }]);
    (api.coupons.use as jest.Mock).mockResolvedValue({ item: { code: 'ABCD' } });
    (api.cafes.updatePin as jest.Mock).mockResolvedValue({});
    (api.rewards.create as jest.Mock).mockResolvedValue({});
    (api.rewards.delete as jest.Mock).mockResolvedValue({});
  });

  it('sets default pin when no cafe assignment exists', async () => {
    const { result } = renderHook(() =>
      useCafeAdmin({ currentUser: { ...baseUser, cafe_id: null } })
    );

    act(() => {
      result.current.setActiveTab('settings');
    });

    await waitFor(() => {
      expect(result.current.currentPin).toBe('0000');
    });
  });

  it('validates empty coupon code before submit', async () => {
    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    await act(async () => {
      await result.current.submitCoupon();
    });

    expect(result.current.couponStatus).toBe('error');
    expect(result.current.couponMessage).toBe('Kupon kodu boş olamaz.');
  });

  it('submits coupon with normalized code and stores last item', async () => {
    (api.coupons.use as jest.Mock).mockResolvedValueOnce({
      item: {
        id: 91,
        code: 'ZXCV',
        item_title: 'Bedava Filtre Kahve',
        user_id: 44,
      },
    });

    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));
    act(() => {
      result.current.setCouponCode(' zxcv ');
    });

    await act(async () => {
      await result.current.submitCoupon();
    });

    expect(api.coupons.use).toHaveBeenCalledWith('ZXCV');
    expect(result.current.couponStatus).toBe('success');
    expect(result.current.lastItem?.code).toBe('ZXCV');
    expect(result.current.couponCode).toBe('');
  });

  it('maps coupon API object-errors and keeps safe state', async () => {
    (api.coupons.use as jest.Mock).mockRejectedValueOnce({
      response: { data: { error: 'Kupon geçersiz' } },
    });

    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));
    act(() => {
      result.current.setCouponCode('BAD1');
    });

    await act(async () => {
      await result.current.submitCoupon();
    });

    expect(result.current.couponStatus).toBe('error');
    expect(result.current.couponMessage).toBe('Kupon geçersiz');
    expect(result.current.lastItem).toBeNull();
  });

  it('throws while creating reward if cafe is missing', async () => {
    const { result } = renderHook(() =>
      useCafeAdmin({ currentUser: { ...baseUser, cafe_id: null } })
    );

    await expect(
      act(async () => {
        await result.current.createReward();
      })
    ).rejects.toThrow('Ödül eklemek için önce bir kafeye atanmalısın.');
  });

  it('updates and validates pin rules', async () => {
    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setNewPin('12');
    });
    await act(async () => {
      await result.current.updatePin();
    });
    expect(result.current.pinStatus).toBe('error');
    expect(result.current.pinMessage).toBe('PIN 4-6 haneli olmalıdır.');

    act(() => {
      result.current.setNewPin('4321');
    });
    await act(async () => {
      await result.current.updatePin();
    });
    expect(api.cafes.updatePin).toHaveBeenCalledWith(1, '4321', 10);
    expect(result.current.pinStatus).toBe('success');
    expect(result.current.currentPin).toBe('4321');
  });

  it('handles pin update errors and generates random pin', async () => {
    (api.cafes.updatePin as jest.Mock).mockRejectedValueOnce(new Error('db fail'));
    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setNewPin('5555');
    });
    await act(async () => {
      await result.current.updatePin();
    });

    expect(result.current.pinStatus).toBe('error');
    expect(result.current.pinMessage).toBe('db fail');

    act(() => {
      result.current.generateRandomPin();
    });
    expect(result.current.newPin).toMatch(/^\d{4}$/);
  });

  it('sets pin error when cafe assignment is missing on update', async () => {
    const { result } = renderHook(() =>
      useCafeAdmin({ currentUser: { ...baseUser, cafe_id: null } })
    );

    act(() => {
      result.current.setNewPin('1234');
    });

    await act(async () => {
      await result.current.updatePin();
    });

    expect(result.current.pinStatus).toBe('error');
    expect(result.current.pinMessage).toBe('Kafe bilgisi bulunamadı.');
  });

  it('falls back safely for malformed coupon payloads and unknown coupon errors', async () => {
    (api.coupons.use as jest.Mock).mockResolvedValueOnce({ item: {} });

    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));
    act(() => {
      result.current.setCouponCode('BAD2');
    });
    await act(async () => {
      await result.current.submitCoupon();
    });

    expect(result.current.couponStatus).toBe('success');
    expect(result.current.lastItem).toBeNull();

    (api.coupons.use as jest.Mock).mockRejectedValueOnce('unknown');
    act(() => {
      result.current.setCouponCode('BAD3');
    });
    await act(async () => {
      await result.current.submitCoupon();
    });
    expect(result.current.couponStatus).toBe('error');
    expect(result.current.couponMessage).toBe('Kupon kullanılamadı.');
  });

  it('keeps default pin when cafe info loading fails and sets rewards error on list failure', async () => {
    (api.cafes.list as jest.Mock).mockRejectedValueOnce(new Error('list fail'));
    (api.rewards.list as jest.Mock).mockRejectedValueOnce(new Error('reward fail'));

    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setActiveTab('settings');
    });

    await waitFor(() => {
      expect(result.current.currentPin).toBe('0000');
    });

    act(() => {
      result.current.setActiveTab('rewards');
    });

    await waitFor(() => {
      expect(result.current.rewards).toEqual([]);
      expect(result.current.rewardsError).toBe('Ödüller yüklenemedi.');
    });
  });
});
