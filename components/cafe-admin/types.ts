import type { Reward, Cafe } from '../../types';

export type CafeAdminTab = 'verification' | 'rewards' | 'settings';

export type CafeCouponStatus = 'idle' | 'success' | 'error';
export type CafeLocationStatus = 'idle' | 'success' | 'error';

export interface CouponItem {
  id?: number;
  code: string;
  item_title?: string;
  itemTitle?: string;
  user_id?: number;
  username?: string;
  used_at?: string;
  usedAt?: string;
}

export interface RewardFormData {
  title: string;
  cost: number;
  description: string;
  icon: Reward['icon'];
}

export interface CafeDashboardStats {
  rewardCount: number;
  locationSummary: string;
  lastCouponCode: string | null;
}

export interface CafeInfoState {
  cafe: Cafe | null;
  latitude: number | null;
  longitude: number | null;
  radius: number;
  secondaryLatitude?: number | null;
  secondaryLongitude?: number | null;
  secondaryRadius?: number | null;
}
