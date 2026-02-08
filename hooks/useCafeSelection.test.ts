import { act, renderHook, waitFor } from '@testing-library/react';
import { useCafeSelection } from './useCafeSelection';
import { api } from '../lib/api';
import type { User } from '../types';

jest.mock('../lib/api', () => ({
  api: {
    cafes: {
      list: jest.fn(),
      checkIn: jest.fn(),
    },
  },
}));

describe('useCafeSelection', () => {
  const mockUser: User = {
    id: 7,
    username: 'emin',
    email: 'emin@example.com',
    points: 120,
    wins: 4,
    gamesPlayed: 11,
    role: 'user',
    isAdmin: false,
  };

  const onCheckInSuccess = jest.fn();
  const memoryStorage = new Map<string, string>();

  beforeEach(() => {
    jest.clearAllMocks();
    onCheckInSuccess.mockReset();
    memoryStorage.clear();

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn((key: string) => (memoryStorage.has(key) ? memoryStorage.get(key)! : null)),
        setItem: jest.fn((key: string, value: string) => {
          memoryStorage.set(key, String(value));
        }),
        removeItem: jest.fn((key: string) => {
          memoryStorage.delete(key);
        }),
        clear: jest.fn(() => {
          memoryStorage.clear();
        }),
      },
      writable: true,
    });
  });

  it('handles empty cafe list safely', async () => {
    (api.cafes.list as jest.Mock).mockResolvedValueOnce([]);

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );

    await waitFor(() => {
      expect(result.current.cafes).toEqual([]);
      expect(result.current.selectedCafeId).toBeNull();
    });
  });

  it('restores saved cafe and table when cache is valid', async () => {
    localStorage.setItem('last_cafe_id', '2');
    localStorage.setItem('last_table_number', '9');
    (api.cafes.list as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Kafe A', table_count: 20 },
      { id: 2, name: 'Kafe B', table_count: 30 },
    ]);

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );

    await waitFor(() => {
      expect(result.current.selectedCafeId).toBe('2');
      expect(result.current.tableNumber).toBe('9');
    });
  });

  it('falls back to first cafe and clears stale saved cafe id', async () => {
    localStorage.setItem('last_cafe_id', '999');
    (api.cafes.list as jest.Mock).mockResolvedValue([
      { id: 44, name: 'Tek Kafe', table_count: 10 },
    ]);

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );

    await waitFor(() => {
      expect(result.current.selectedCafeId).toBe('44');
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('last_cafe_id');
    });
  });

  it('surfaces load error when cafe fetch fails', async () => {
    (api.cafes.list as jest.Mock).mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );

    await waitFor(() => {
      expect(result.current.error).toContain('Kafeler yüklenemedi');
      expect(result.current.error).toContain('network down');
    });
  });

  it('clears pin/error when selected cafe changes and clearError is called', async () => {
    (api.cafes.list as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Kafe A', table_count: 20 },
      { id: 2, name: 'Kafe B', table_count: 20 },
    ]);

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );

    await waitFor(() => expect(result.current.selectedCafeId).toBe('1'));

    await act(async () => {
      await result.current.checkIn();
    });
    expect(result.current.error).toBe('Lütfen kafe ve masa numarası seçin.');

    act(() => {
      result.current.setPin('1234');
      result.current.setSelectedCafeId('2');
    });
    expect(result.current.pin).toBe('');
    expect(result.current.error).toBeNull();

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it('validates missing data, pin length and table range', async () => {
    (api.cafes.list as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Kafe A', table_count: 5 },
    ]);

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );

    await waitFor(() => expect(result.current.selectedCafeId).toBe('1'));

    await act(async () => {
      await result.current.checkIn();
    });
    expect(result.current.error).toBe('Lütfen kafe ve masa numarası seçin.');

    act(() => {
      result.current.setTableNumber('3');
      result.current.setPin('12');
    });
    await act(async () => {
      await result.current.checkIn();
    });
    expect(result.current.error).toBe('PIN kodu 4 haneli olmalıdır.');

    act(() => {
      result.current.setPin('1234');
      result.current.setTableNumber('99');
    });
    await act(async () => {
      await result.current.checkIn();
    });
    expect(result.current.error).toContain('Masa numarası 1 ile 5 arasında olmalıdır.');
  });

  it('maps network errors and resets pin on failed check-in', async () => {
    (api.cafes.list as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Kafe A', table_count: 10 },
    ]);
    (api.cafes.checkIn as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );
    await waitFor(() => expect(result.current.selectedCafeId).toBe('1'));

    act(() => {
      result.current.setTableNumber('2');
      result.current.setPin('1234');
    });
    await act(async () => {
      await result.current.checkIn();
    });

    expect(result.current.error).toBe('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    expect(result.current.pin).toBe('');
  });

  it('completes successful check-in and persists last selection', async () => {
    (api.cafes.list as jest.Mock).mockResolvedValue([
      { id: 5, name: 'Kafe X', table_count: 10 },
    ]);
    (api.cafes.checkIn as jest.Mock).mockResolvedValueOnce({
      cafeName: 'Kafe X',
      table: 'MASA03',
    });

    const { result } = renderHook(() =>
      useCafeSelection({ currentUser: mockUser, onCheckInSuccess })
    );
    await waitFor(() => expect(result.current.selectedCafeId).toBe('5'));

    act(() => {
      result.current.setTableNumber('3');
      result.current.setPin('1234');
    });

    await act(async () => {
      await result.current.checkIn();
    });

    expect(api.cafes.checkIn).toHaveBeenCalledWith({
      cafeId: '5',
      tableNumber: 3,
      pin: '1234',
    });
    expect(onCheckInSuccess).toHaveBeenCalledWith('Kafe X', 'MASA03', '5');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('last_cafe_id', '5');
    expect(window.localStorage.setItem).toHaveBeenCalledWith('last_table_number', '3');
  });
});
