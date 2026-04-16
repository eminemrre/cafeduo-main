import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Reward, User } from '../types';
import type {
  CafeAdminTab,
  CafeCouponStatus,
  CafeLocationStatus,
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
  locationLatitude: string;
  locationLongitude: string;
  locationRadius: string;
  locationSecondaryLatitude: string;
  locationSecondaryLongitude: string;
  locationSecondaryRadius: string;
  setLocationLatitude: (value: string) => void;
  setLocationLongitude: (value: string) => void;
  setLocationRadius: (value: string) => void;
  setLocationSecondaryLatitude: (value: string) => void;
  setLocationSecondaryLongitude: (value: string) => void;
  setLocationSecondaryRadius: (value: string) => void;
  locationStatus: CafeLocationStatus;
  locationMessage: string;
  locationLoading: boolean;
  submitCoupon: () => Promise<void>;
  createReward: () => Promise<void>;
  deleteReward: (id: number | string) => Promise<void>;
  updateLocation: () => Promise<void>;
  pickCurrentLocation: () => Promise<void>;
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

const toLocationError = (errorCode: number): string => {
  const map: Record<number, string> = {
    1: 'Konum izni reddedildi. Tarayıcı ayarlarından konum izni verin.',
    2: 'Konum bilgisi alınamadı. GPS veya ağ konumunu kontrol edin.',
    3: 'Konum isteği zaman aşımına uğradı. Tekrar deneyin.',
  };
  return map[errorCode] || 'Konum alınamadı.';
};

const ensureGeo = async (): Promise<{ latitude: number; longitude: number }> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Tarayıcı konum bilgisini desteklemiyor.');
  }

  return await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: Number(position.coords.latitude),
          longitude: Number(position.coords.longitude),
        });
      },
      (error) => {
        reject(new Error(toLocationError(error.code)));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  });
};

/**
 * useCafeAdmin Hook
 *
 * @description Kafe admin panelindeki kupon doğrulama, ödül yönetimi ve konum doğrulama
 * ayarlarını tek yerde yönetir.
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

  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [locationRadius, setLocationRadius] = useState('150');
  const [locationSecondaryLatitude, setLocationSecondaryLatitude] = useState('');
  const [locationSecondaryLongitude, setLocationSecondaryLongitude] = useState('');
  const [locationSecondaryRadius, setLocationSecondaryRadius] = useState('150');
  const [locationStatus, setLocationStatus] = useState<CafeLocationStatus>('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const cafeId = useMemo(() => currentUser.cafe_id, [currentUser.cafe_id]);

  const fetchCafeInfo = useCallback(async () => {
    if (!cafeId) {
      setLocationLatitude('');
      setLocationLongitude('');
      setLocationRadius('150');
      setLocationSecondaryLatitude('');
      setLocationSecondaryLongitude('');
      setLocationSecondaryRadius('150');
      return;
    }

    try {
      const cafes = await api.cafes.list();
      const cafe = cafes.find((row) => String(row.id) === String(cafeId));
      setLocationLatitude(cafe?.latitude != null ? String(cafe.latitude) : '');
      setLocationLongitude(cafe?.longitude != null ? String(cafe.longitude) : '');
      setLocationRadius(String(Number(cafe?.radius || 150)));
      setLocationSecondaryLatitude(cafe?.secondary_latitude != null ? String(cafe.secondary_latitude) : '');
      setLocationSecondaryLongitude(cafe?.secondary_longitude != null ? String(cafe.secondary_longitude) : '');
      setLocationSecondaryRadius(String(Number(cafe?.secondary_radius || cafe?.radius || 150)));
    } catch (err) {
      console.error('Failed to fetch cafe info', err);
      setLocationLatitude('');
      setLocationLongitude('');
      setLocationRadius('150');
      setLocationSecondaryLatitude('');
      setLocationSecondaryLongitude('');
      setLocationSecondaryRadius('150');
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

  const updateLocation = useCallback(async () => {
    if (!cafeId) {
      setLocationStatus('error');
      setLocationMessage('Kafe bilgisi bulunamadı.');
      return;
    }

    const latitude = Number(locationLatitude);
    const longitude = Number(locationLongitude);
    const radius = Number(locationRadius);
    const hasSecondaryInput =
      Boolean(String(locationSecondaryLatitude || '').trim()) ||
      Boolean(String(locationSecondaryLongitude || '').trim());
    const secondaryLatitude = Number(locationSecondaryLatitude);
    const secondaryLongitude = Number(locationSecondaryLongitude);
    const secondaryRadius = Number(locationSecondaryRadius);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setLocationStatus('error');
      setLocationMessage('Enlem -90 ile 90 arasında olmalıdır.');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setLocationStatus('error');
      setLocationMessage('Boylam -180 ile 180 arasında olmalıdır.');
      return;
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
      setLocationStatus('error');
      setLocationMessage('Yarıçap 10-5000 metre arasında olmalıdır.');
      return;
    }
    if (hasSecondaryInput) {
      if (!Number.isFinite(secondaryLatitude) || secondaryLatitude < -90 || secondaryLatitude > 90) {
        setLocationStatus('error');
        setLocationMessage('İkinci konum enlem değeri -90 ile 90 arasında olmalıdır.');
        return;
      }
      if (!Number.isFinite(secondaryLongitude) || secondaryLongitude < -180 || secondaryLongitude > 180) {
        setLocationStatus('error');
        setLocationMessage('İkinci konum boylam değeri -180 ile 180 arasında olmalıdır.');
        return;
      }
      if (!Number.isFinite(secondaryRadius) || secondaryRadius < 10 || secondaryRadius > 5000) {
        setLocationStatus('error');
        setLocationMessage('İkinci konum yarıçapı 10-5000 metre arasında olmalıdır.');
        return;
      }
    }

    setLocationLoading(true);
    setLocationStatus('idle');
    setLocationMessage('');

    try {
      await api.cafes.updateLocation(cafeId, {
        latitude,
        longitude,
        radius,
        secondaryLatitude: hasSecondaryInput ? secondaryLatitude : null,
        secondaryLongitude: hasSecondaryInput ? secondaryLongitude : null,
        secondaryRadius: hasSecondaryInput ? secondaryRadius : null,
      });
      setLocationRadius(String(Math.round(radius)));
      if (hasSecondaryInput) {
        setLocationSecondaryRadius(String(Math.round(secondaryRadius)));
      }
      setLocationStatus('success');
      setLocationMessage('Kafe konumu güncellendi.');
    } catch (err) {
      setLocationStatus('error');
      setLocationMessage(toErrorMessage(err, 'Kafe konumu güncellenemedi.'));
    } finally {
      setLocationLoading(false);
    }
  }, [
    cafeId,
    locationLatitude,
    locationLongitude,
    locationRadius,
    locationSecondaryLatitude,
    locationSecondaryLongitude,
    locationSecondaryRadius,
  ]);

  const pickCurrentLocation = useCallback(async () => {
    setLocationStatus('idle');
    setLocationMessage('');
    try {
      const coords = await ensureGeo();
      setLocationLatitude(coords.latitude.toFixed(6));
      setLocationLongitude(coords.longitude.toFixed(6));
      setLocationStatus('success');
      setLocationMessage('Konum alındı. Kaydetmek için "Konumu Kaydet"e basın.');
    } catch (err) {
      setLocationStatus('error');
      setLocationMessage(toErrorMessage(err, 'Konum alınamadı.'));
    }
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
    locationLatitude,
    locationLongitude,
    locationRadius,
    locationSecondaryLatitude,
    locationSecondaryLongitude,
    locationSecondaryRadius,
    setLocationLatitude,
    setLocationLongitude,
    setLocationRadius,
    setLocationSecondaryLatitude,
    setLocationSecondaryLongitude,
    setLocationSecondaryRadius,
    locationStatus,
    locationMessage,
    locationLoading,
    submitCoupon,
    createReward,
    deleteReward,
    updateLocation,
    pickCurrentLocation,
    refetchRewards: fetchRewards,
  };
}
