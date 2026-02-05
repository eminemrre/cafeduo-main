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
    try {
      setRewardsLoading(true);
      const data = await api.rewards.list();
      setRewards(data);
      setRewardsError(null);
    } catch (err) {
      console.error('Failed to load rewards:', err);
      setRewardsError('Ödüller yüklenemedi');
    } finally {
      setRewardsLoading(false);
    }
  }, []);

  /**
   * Kullanıcı envanterini çek
   */
  const fetchInventory = useCallback(async () => {
    try {
      setInventoryLoading(true);
      const data = await api.shop.inventory(currentUser.id);
      
      // Tarih dönüşümü
      const formattedData = data.map((item: any) => ({
        ...item,
        redeemedAt: new Date(item.redeemedAt)
      }));
      
      setInventory(formattedData);
      setInventoryError(null);
    } catch (err) {
      console.error('Failed to load inventory:', err);
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
