/**
 * useRewards Hook
 * 
 * @description Ödül mağazası ve envanter yönetimi için custom hook
 * @returns Ödül verileri ve yönetim fonksiyonları
 */

import { useState, useEffect, useCallback } from 'react';
import { Reward, RedeemedReward, User } from '../types';
import { api } from '../lib/api';

interface UseRewardsProps {
  currentUser: User;
}

type InventoryApiItem = Omit<RedeemedReward, 'redeemedAt'> & {
  redeemedAt: string | Date;
};

interface UseRewardsReturn {
  // Mağaza
  rewards: Reward[];
  rewardsLoading: boolean;
  rewardsError: string | null;
  
  // Envanter
  inventory: RedeemedReward[];
  inventoryLoading: boolean;
  inventoryError: string | null;
  
  // Tab state
  activeTab: 'shop' | 'inventory';
  setActiveTab: (tab: 'shop' | 'inventory') => void;
  
  // İşlemler
  buyReward: (reward: Reward) => Promise<{ success: boolean; newPoints: number; code: string }>;
  refetchRewards: () => Promise<void>;
  refetchInventory: () => Promise<void>;
  
  // Yardımcılar
  canAfford: (cost: number) => boolean;
}

export function useRewards({ currentUser }: UseRewardsProps): UseRewardsReturn {
  // Mağaza state'leri
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  
  // Envanter state'leri
  const [inventory, setInventory] = useState<RedeemedReward[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  
  // Aktif tab
  const [activeTab, setActiveTab] = useState<'shop' | 'inventory'>('shop');

  /**
   * Mağaza ödüllerini çek
   */
  const fetchRewards = useCallback(async () => {
    // Skip the round-trip when the user hasn't checked in yet. Without a
    // cafe_id the API returns [] anyway (rewards are cafe-scoped server-side),
    // and the empty fetch on first mount caused a brief 'Mağaza Boş' flash
    // before the re-fetch fired once cafe_id arrived from /api/auth/me.
    if (!currentUser?.cafe_id) {
      setRewards([]);
      setRewardsError(null);
      setRewardsLoading(false);
      return;
    }
    try {
      setRewardsLoading(true);
      const fetched = await api.rewards.list(currentUser.cafe_id);
      setRewards(Array.isArray(fetched) ? fetched : []);
      setRewardsError(null);
    } catch (err: unknown) {
      console.error('Failed to load rewards:', err);
      setRewards([]);
      setRewardsError('Ödüller yüklenemedi');
    } finally {
      setRewardsLoading(false);
    }
  }, [currentUser?.cafe_id]);

  /**
   * Kullanıcı envanterini çek
   */
  const fetchInventory = useCallback(async () => {
    try {
      setInventoryLoading(true);
      const fetched = await api.shop.inventory(currentUser.id);

      // Tarih dönüşümü
      const rows = (Array.isArray(fetched) ? fetched : []) as InventoryApiItem[];
      const formattedData = rows.map((item) => ({
        ...item,
        redeemedAt: new Date(item.redeemedAt)
      }));

      setInventory(formattedData);
      setInventoryError(null);
    } catch (err: unknown) {
      console.error('Failed to load inventory:', err);
      setInventory([]);
      setInventoryError('Envanter yüklenemedi');
    } finally {
      setInventoryLoading(false);
    }
  }, [currentUser.id]);

  /**
   * Ödül satın al
   */
  const buyReward = useCallback(async (reward: Reward): Promise<{ success: boolean; newPoints: number; code: string }> => {
    // Yeterli puan kontrolü
    if (currentUser.points < reward.cost) {
      throw new Error(`Yetersiz puan! ${reward.cost} puan gerekli, ${currentUser.points} puanınız var.`);
    }

    try {
      const result = await api.shop.buy(reward.id);
      
      if (!result.success) {
        throw new Error(result.error || 'Satın alma başarısız');
      }

      // Envanteri yenile
      await fetchInventory();
      
      return {
        success: true,
        newPoints: result.newPoints,
        code: result.reward?.code || ''
      };
    } catch (err) {
      console.error('Failed to buy reward:', err);
      throw err;
    }
  }, [currentUser.points, fetchInventory]);

  /**
   * Puan yeterli mi kontrolü
   */
  const canAfford = useCallback((cost: number): boolean => {
    return currentUser.points >= cost;
  }, [currentUser.points]);

  /**
   * Manuel yenileme fonksiyonları
   */
  const refetchRewards = useCallback(async () => {
    await fetchRewards();
  }, [fetchRewards]);

  const refetchInventory = useCallback(async () => {
    await fetchInventory();
  }, [fetchInventory]);

  /**
   * İlk yükleme
   */
  useEffect(() => {
    fetchRewards();
    fetchInventory();
  }, [fetchRewards, fetchInventory]);

  return {
    // Mağaza
    rewards,
    rewardsLoading,
    rewardsError,
    
    // Envanter
    inventory,
    inventoryLoading,
    inventoryError,
    
    // Tab
    activeTab,
    setActiveTab,
    
    // İşlemler
    buyReward,
    refetchRewards,
    refetchInventory,
    
    // Yardımcılar
    canAfford
  };
}
