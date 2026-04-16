import { act, renderHook, waitFor } from '@testing-library/react';
import { useCafeAdmin } from './useCafeAdmin';
import { api } from '../lib/api';
import type { User } from '../types';

jest.mock('../lib/api', () => ({
  api: {
    cafes: {
      list: jest.fn(),
      updateLocation: jest.fn(),
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
    (api.cafes.list as jest.Mock).mockResolvedValue([{ id: 1, name: 'Cafe', latitude: 37.741, longitude: 29.101, radius: 150 }]);
    (api.coupons.use as jest.Mock).mockResolvedValue({ item: { code: 'ABCD' } });
    (api.cafes.updateLocation as jest.Mock).mockResolvedValue({});
    (api.rewards.create as jest.Mock).mockResolvedValue({});
    (api.rewards.delete as jest.Mock).mockResolvedValue({});
  });

  it('sets default location state when no cafe assignment exists', async () => {
    const { result } = renderHook(() =>
      useCafeAdmin({ currentUser: { ...baseUser, cafe_id: null } })
    );

    act(() => {
      result.current.setActiveTab('settings');
    });

    await waitFor(() => {
      expect(result.current.locationLatitude).toBe('');
      expect(result.current.locationLongitude).toBe('');
      expect(result.current.locationRadius).toBe('150');
      expect(result.current.locationSecondaryLatitude).toBe('');
      expect(result.current.locationSecondaryLongitude).toBe('');
      expect(result.current.locationSecondaryRadius).toBe('150');
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

  it('updates and validates location rules', async () => {
    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setLocationLatitude('190');
    });
    await act(async () => {
      await result.current.updateLocation();
    });
    expect(result.current.locationStatus).toBe('error');
    expect(result.current.locationMessage).toBe('Enlem -90 ile 90 arasında olmalıdır.');

    act(() => {
      result.current.setLocationLatitude('37.742');
      result.current.setLocationLongitude('29.102');
      result.current.setLocationRadius('180');
    });
    await act(async () => {
      await result.current.updateLocation();
    });
    expect(api.cafes.updateLocation).toHaveBeenCalledWith(1, {
      latitude: 37.742,
      longitude: 29.102,
      radius: 180,
      secondaryLatitude: null,
      secondaryLongitude: null,
      secondaryRadius: null,
    });
    expect(result.current.locationStatus).toBe('success');
  });

  it('handles location update errors', async () => {
    (api.cafes.updateLocation as jest.Mock).mockRejectedValueOnce(new Error('db fail'));
    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setLocationLatitude('37.741');
      result.current.setLocationLongitude('29.101');
      result.current.setLocationRadius('150');
    });
    await act(async () => {
      await result.current.updateLocation();
    });

    expect(result.current.locationStatus).toBe('error');
    expect(result.current.locationMessage).toBe('db fail');
  });

  it('submits secondary location when provided', async () => {
    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setLocationLatitude('37.741');
      result.current.setLocationLongitude('29.101');
      result.current.setLocationRadius('150');
      result.current.setLocationSecondaryLatitude('37.744');
      result.current.setLocationSecondaryLongitude('29.109');
      result.current.setLocationSecondaryRadius('260');
    });

    await act(async () => {
      await result.current.updateLocation();
    });

    expect(api.cafes.updateLocation).toHaveBeenCalledWith(1, {
      latitude: 37.741,
      longitude: 29.101,
      radius: 150,
      secondaryLatitude: 37.744,
      secondaryLongitude: 29.109,
      secondaryRadius: 260,
    });
    expect(result.current.locationStatus).toBe('success');
  });

  it('sets location error when cafe assignment is missing on update', async () => {
    const { result } = renderHook(() =>
      useCafeAdmin({ currentUser: { ...baseUser, cafe_id: null } })
    );

    act(() => {
      result.current.setLocationLatitude('37.741');
      result.current.setLocationLongitude('29.101');
      result.current.setLocationRadius('150');
    });

    await act(async () => {
      await result.current.updateLocation();
    });

    expect(result.current.locationStatus).toBe('error');
    expect(result.current.locationMessage).toBe('Kafe bilgisi bulunamadı.');
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

  it('keeps default location when cafe info loading fails and sets rewards error on list failure', async () => {
    (api.cafes.list as jest.Mock).mockRejectedValueOnce(new Error('list fail'));
    (api.rewards.list as jest.Mock).mockRejectedValueOnce(new Error('reward fail'));

    const { result } = renderHook(() => useCafeAdmin({ currentUser: baseUser }));

    act(() => {
      result.current.setActiveTab('settings');
    });

    await waitFor(() => {
      expect(result.current.locationLatitude).toBe('');
      expect(result.current.locationLongitude).toBe('');
      expect(result.current.locationRadius).toBe('150');
      expect(result.current.locationSecondaryLatitude).toBe('');
      expect(result.current.locationSecondaryLongitude).toBe('');
      expect(result.current.locationSecondaryRadius).toBe('150');
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
