import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { GameHistoryEntry } from '../types';

type InventoryItem = Awaited<ReturnType<typeof api.store.inventory>>['inventory'][number];
type Resource<T> = { owner: string | null; status: 'loading' | 'success' | 'error'; data: T[] };
const pending = <T>(owner: string | null): Resource<T> => ({ owner, status: 'loading', data: [] });

/** Fetch private profile data only on demand; never reuse it for another player. */
export function useProfileData(
  userId: string | number | undefined,
  username: string,
  enabled: boolean
) {
  const owner = enabled && userId !== undefined ? `${userId}:${username}` : null;
  const [history, setHistory] = useState<Resource<GameHistoryEntry>>(() => pending(null));
  const [inventory, setInventory] = useState<Resource<InventoryItem>>(() => pending(null));
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [inventoryAttempt, setInventoryAttempt] = useState(0);

  useEffect(() => {
    if (!owner) {
      setHistory(pending(null));
      return;
    }
    let active = true;
    setHistory(pending(owner));
    void api.users.getGameHistory(username, { throwOnError: true }).then(
      (data) => {
        if (active) setHistory({ owner, status: 'success', data: data.slice(0, 3) });
      },
      () => {
        if (active) setHistory({ owner, status: 'error', data: [] });
      }
    );
    return () => {
      active = false;
    };
  }, [owner, username, historyAttempt]);

  useEffect(() => {
    if (!owner) {
      setInventory(pending(null));
      return;
    }
    let active = true;
    setInventory(pending(owner));
    void api.store.inventory().then(
      (result) => {
        if (!active) return;
        if (
          !result ||
          result.success !== true ||
          !Array.isArray(result.inventory) ||
          !result.inventory.every(
            (item) =>
              item &&
              typeof item.item_title === 'string' &&
              (typeof item.id === 'number' || typeof item.id === 'string')
          )
        ) {
          setInventory({ owner, status: 'error', data: [] });
          return;
        }
        setInventory({ owner, status: 'success', data: result.inventory });
      },
      () => {
        if (active) setInventory({ owner, status: 'error', data: [] });
      }
    );
    return () => {
      active = false;
    };
  }, [owner, inventoryAttempt]);

  return {
    history: owner && history.owner === owner ? history : pending<GameHistoryEntry>(owner),
    inventory: owner && inventory.owner === owner ? inventory : pending<InventoryItem>(owner),
    retryHistory: () => setHistoryAttempt((attempt) => attempt + 1),
    retryInventory: () => setInventoryAttempt((attempt) => attempt + 1),
  };
}
