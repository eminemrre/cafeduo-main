import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Reward, User } from '../types';
import type {
  CafeAdminTab,
  CafeCouponStatus,
  CafePinStatus,
  CouponItem,
  RewardFormData,
} from '../components/cafe-admin/types';

interface UseCafeAdminProps {
  currentUser: User;
}

interface UseCafeAdminReturn {
  activeTab: CafeAdminTab;
  setActiveTab: (tab: CafeAdminTab) => void;
  couponCode: string;
  setCouponCode: (code: string) => void;
  couponStatus: CafeCouponStatus;
  couponMessage: string;
  lastItem: CouponItem | null;
  couponSubmitting: boolean;
  rewards: Reward[];
  rewardsLoading: boolean;
  rewardsError: string | null;
  rewardForm: RewardFormData;
  setRewardForm: (form: RewardFormData) => void;
  currentPin: string;
  newPin: string;
  setNewPin: (pin: string) => void;
  pinStatus: CafePinStatus;
  pinMessage: string;
  pinLoading: boolean;
  submitCoupon: () => Promise<void>;
  createReward: () => Promise<void>;
  deleteReward: (id: number | string) => Promise<void>;
  updatePin: () => Promise<void>;
  generateRandomPin: () => void;
  refetchRewards: () => Promise<void>;
}

const DEFAULT_REWARD_FORM: RewardFormData = {
  title: '',
  cost: 500,
  description: '',
  icon: 'coffee',
};

const toErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof Error && err.message) {
    return err.message;
  }

  if (typeof err === 'object' && err !== null) {
    const responseError = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
    if (typeof responseError === 'string' && responseError.trim()) {
      return responseError;
    }
  }

  return fallback;
};

const normalizeCouponItem = (item: unknown): CouponItem | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const source = item as Record<string, unknown>;
  const code = String(source.code || '').trim();
  if (!code) {
    return null;
  }

  return {
    id: Number.isFinite(Number(source.id)) ? Number(source.id) : undefined,
    code,
    item_title: source.item_title ? String(source.item_title) : undefined,
    itemTitle: source.itemTitle ? String(source.itemTitle) : undefined,
    user_id: Number.isFinite(Number(source.user_id)) ? Number(source.user_id) : undefined,
    username: source.username ? String(source.username) : undefined,
    used_at: source.used_at ? String(source.used_at) : undefined,
    usedAt: source.usedAt ? String(source.usedAt) : undefined,
  };
};

/**
 * useCafeAdmin Hook
 *
 * @description Kafe admin panelindeki kupon doğrulama, ödül yönetimi ve PIN güncelleme
 * işlemlerini tek yerde yönetir. UI bileşenleri sadece sunuma odaklanır.
 */
export function useCafeAdmin({ currentUser }: UseCafeAdminProps): UseCafeAdminReturn {
  const [activeTab, setActiveTab] = useState<CafeAdminTab>('verification');

  const [couponCode, setCouponCode] = useState('');
  const [couponStatus, setCouponStatus] = useState<CafeCouponStatus>('idle');
  const [couponMessage, setCouponMessage] = useState('');
  const [lastItem, setLastItem] = useState<CouponItem | null>(null);
  const [couponSubmitting, setCouponSubmitting] = useState(false);

  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState<RewardFormData>(DEFAULT_REWARD_FORM);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState<CafePinStatus>('idle');
  const [pinMessage, setPinMessage] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const cafeId = useMemo(() => currentUser.cafe_id, [currentUser.cafe_id]);

  const fetchCafeInfo = useCallback(async () => {
    if (!cafeId) {
      setCurrentPin('0000');
      return;
    }

    try {
      const cafes = await api.cafes.list();
      const cafe = cafes.find((row) => String(row.id) === String(cafeId));
      setCurrentPin(String(cafe?.daily_pin || cafe?.pin || '0000'));
    } catch (err) {
      console.error('Failed to fetch cafe info', err);
      setCurrentPin('0000');
    }
  }, [cafeId]);

  const fetchRewards = useCallback(async () => {
    try {
      setRewardsLoading(true);
      const data = await api.rewards.list(cafeId);
      setRewards(Array.isArray(data) ? data : []);
      setRewardsError(null);
    } catch (err) {
      console.error('Failed to fetch rewards', err);
      setRewards([]);
      setRewardsError('Ödüller yüklenemedi.');
    } finally {
      setRewardsLoading(false);
    }
  }, [cafeId]);

  useEffect(() => {
    if (activeTab === 'rewards') {
      void fetchRewards();
    }
    if (activeTab === 'settings') {
      void fetchCafeInfo();
    }
  }, [activeTab, fetchRewards, fetchCafeInfo]);

  const submitCoupon = useCallback(async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) {
      setCouponStatus('error');
      setCouponMessage('Kupon kodu boş olamaz.');
      setLastItem(null);
      return;
    }

    setCouponSubmitting(true);
    setCouponStatus('idle');
    setCouponMessage('');
    setLastItem(null);

    try {
      const response = await api.coupons.use(normalizedCode);
      setCouponStatus('success');
      setCouponMessage('Kupon başarıyla kullanıldı!');
      setLastItem(normalizeCouponItem(response.item));
      setCouponCode('');
    } catch (err: unknown) {
      setCouponStatus('error');
      setCouponMessage(toErrorMessage(err, 'Kupon kullanılamadı.'));
      setLastItem(null);
    } finally {
      setCouponSubmitting(false);
    }
  }, [couponCode]);

  const createReward = useCallback(async () => {
    if (!cafeId) {
      throw new Error('Ödül eklemek için önce bir kafeye atanmalısın.');
    }

    await api.rewards.create({
      ...rewardForm,
      cafeId,
    });
    setRewardForm(DEFAULT_REWARD_FORM);
    await fetchRewards();
  }, [cafeId, fetchRewards, rewardForm]);

  const deleteReward = useCallback(async (id: number | string) => {
    await api.rewards.delete(id);
    await fetchRewards();
  }, [fetchRewards]);

  const updatePin = useCallback(async () => {
    if (!cafeId) {
      setPinStatus('error');
      setPinMessage('Kafe bilgisi bulunamadı.');
      return;
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      setPinStatus('error');
      setPinMessage('PIN 4-6 haneli olmalıdır.');
      return;
    }

    setPinLoading(true);
    setPinStatus('idle');
    setPinMessage('');

    try {
      await api.cafes.updatePin(cafeId, newPin, currentUser.id);
      setCurrentPin(newPin);
      setNewPin('');
      setPinStatus('success');
      setPinMessage('PIN başarıyla güncellendi!');
    } catch (err) {
      setPinStatus('error');
      setPinMessage(toErrorMessage(err, 'PIN güncellenemedi.'));
    } finally {
      setPinLoading(false);
    }
  }, [cafeId, currentUser.id, newPin]);

  const generateRandomPin = useCallback(() => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setNewPin(pin);
  }, []);

  return {
    activeTab,
    setActiveTab,
    couponCode,
    setCouponCode,
    couponStatus,
    couponMessage,
    lastItem,
    couponSubmitting,
    rewards,
    rewardsLoading,
    rewardsError,
    rewardForm,
    setRewardForm,
    currentPin,
    newPin,
    setNewPin,
    pinStatus,
    pinMessage,
    pinLoading,
    submitCoupon,
    createReward,
    deleteReward,
    updatePin,
    generateRandomPin,
    refetchRewards: fetchRewards,
  };
}
