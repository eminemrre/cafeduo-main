import { act, renderHook, waitFor } from '@testing-library/react';
import { api } from '../lib/api';
import { useProfileData } from './useProfileData';
import type { GameHistoryEntry } from '../types';

jest.mock('../lib/api', () => ({
  api: { users: { getGameHistory: jest.fn() }, store: { inventory: jest.fn() } },
}));
const history = (id = 1): GameHistoryEntry => ({
  id,
  gameType: 'Retro Satranç',
  points: 20,
  status: 'finished',
  table: 'MASA07',
  opponentName: 'rakip',
  winner: 'emin',
  didWin: true,
  createdAt: '2026-10-02T09:00:00Z',
});
const inventory = [
  { id: 1, user_id: 7, item_id: 1, item_title: 'Özel çerçeve', code: 'private', is_used: false },
];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.resetAllMocks();
  (api.users.getGameHistory as jest.Mock).mockResolvedValue([]);
  (api.store.inventory as jest.Mock).mockResolvedValue({ success: true, inventory: [] });
});

it('only fetches enabled private data and limits recent history to three real entries', async () => {
  (api.users.getGameHistory as jest.Mock).mockResolvedValue([
    history(1),
    history(2),
    history(3),
    history(4),
  ]);
  const { result, rerender } = renderHook(({ enabled }) => useProfileData(7, 'emin', enabled), {
    initialProps: { enabled: false },
  });
  expect(api.store.inventory).not.toHaveBeenCalled();
  expect(api.users.getGameHistory).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.history.status).toBe('success'));
  expect(result.current.history.data.map((x) => x.id)).toEqual([1, 2, 3]);
  expect(api.users.getGameHistory).toHaveBeenCalledWith('emin', { throwOnError: true });
});

it('loads history while a slow inventory request remains pending', async () => {
  const slow = deferred<{ success: boolean; inventory: typeof inventory }>();
  (api.store.inventory as jest.Mock).mockReturnValue(slow.promise);
  (api.users.getGameHistory as jest.Mock).mockResolvedValue([history()]);
  const { result } = renderHook(() => useProfileData(7, 'emin', true));
  await waitFor(() => expect(result.current.history.status).toBe('success'));
  expect(result.current.inventory.status).toBe('loading');
  await act(async () => slow.resolve({ success: true, inventory }));
  expect(result.current.inventory.data).toEqual(inventory);
});

it('retries failed resources independently and never labels failures as empty data', async () => {
  (api.users.getGameHistory as jest.Mock)
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce([history()]);
  (api.store.inventory as jest.Mock)
    .mockResolvedValueOnce({ success: false, inventory: [] })
    .mockResolvedValueOnce({ success: true, inventory });
  const { result } = renderHook(() => useProfileData(7, 'emin', true));
  await waitFor(() => expect(result.current.inventory.status).toBe('error'));
  expect(result.current.history.status).toBe('error');
  act(() => result.current.retryHistory());
  await waitFor(() => expect(result.current.history.status).toBe('success'));
  expect(api.store.inventory).toHaveBeenCalledTimes(1);
  act(() => result.current.retryInventory());
  await waitFor(() => expect(result.current.inventory.status).toBe('success'));
  expect(api.users.getGameHistory).toHaveBeenCalledTimes(2);
});

it('clears old identity immediately and ignores late data after a player switch', async () => {
  const slowHistory = deferred<GameHistoryEntry[]>();
  const slowInventory = deferred<{ success: boolean; inventory: typeof inventory }>();
  (api.users.getGameHistory as jest.Mock)
    .mockReturnValueOnce(slowHistory.promise)
    .mockResolvedValueOnce([]);
  (api.store.inventory as jest.Mock)
    .mockReturnValueOnce(slowInventory.promise)
    .mockResolvedValueOnce({ success: true, inventory: [] });
  const { result, rerender } = renderHook(({ id, name }) => useProfileData(id, name, true), {
    initialProps: { id: 7, name: 'emin' },
  });
  rerender({ id: 8, name: 'other' });
  expect(result.current.history.data).toEqual([]);
  await waitFor(() => expect(result.current.history.status).toBe('success'));
  await act(async () => {
    slowHistory.resolve([history()]);
    slowInventory.resolve({ success: true, inventory });
  });
  expect(result.current.history.data).toEqual([]);
  expect(result.current.inventory.data).toEqual([]);
});

it('hides private data on close and reloads it on reopening', async () => {
  (api.store.inventory as jest.Mock).mockResolvedValue({ success: true, inventory });
  const { result, rerender } = renderHook(({ enabled }) => useProfileData(7, 'emin', enabled), {
    initialProps: { enabled: true },
  });
  await waitFor(() => expect(result.current.inventory.status).toBe('success'));
  rerender({ enabled: false });
  expect(result.current.inventory.data).toEqual([]);
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.inventory.status).toBe('success'));
  expect(api.store.inventory).toHaveBeenCalledTimes(2);
});

it('surfaces malformed inventory and request errors without retaining old products', async () => {
  (api.store.inventory as jest.Mock)
    .mockResolvedValueOnce({ success: true, inventory: [{}] })
    .mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useProfileData(7, 'emin', true));
  await waitFor(() => expect(result.current.inventory.status).toBe('error'));
  act(() => result.current.retryInventory());
  await waitFor(() => expect(api.store.inventory).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(result.current.inventory.status).toBe('error'));
  expect(result.current.inventory.data).toEqual([]);
});
