import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Cafe, User } from '../types';

interface UseCafeSelectionProps {
  currentUser: User;
  onCheckInSuccess: (cafeName: string, tableNumber: string, cafeId: string | number) => void;
}

interface UseCafeSelectionReturn {
  cafes: Cafe[];
  selectedCafeId: string | null;
  tableNumber: string;
  loading: boolean;
  error: string | null;
  selectedCafe: Cafe | null;
  maxTableCount: number;
  locationStatus: 'idle' | 'requesting' | 'ready' | 'denied';
  setSelectedCafeId: (cafeId: string) => void;
  setTableNumber: (tableNumber: string) => void;
  clearError: () => void;
  requestLocationAccess: () => Promise<void>;
  checkIn: () => Promise<void>;
}

const toErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

/**
 * useCafeSelection Hook
 *
 * @description Kafe listesi, masa/konum doğrulama ve check-in akışını yönetir.
 * UI bileşeni yalnızca sunum katmanını taşır.
 */
export function useCafeSelection({
  currentUser,
  onCheckInSuccess,
}: UseCafeSelectionProps): UseCafeSelectionReturn {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [selectedCafeIdState, setSelectedCafeIdState] = useState<string | null>(null);
  const [tableNumberState, setTableNumberState] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCafes = useCallback(async () => {
    try {
      const data = await api.cafes.list();
      const cafeList = Array.isArray(data) ? data : [];
      setCafes(cafeList);

      if (cafeList.length === 0) {
        setSelectedCafeIdState(null);
        return;
      }

      const savedCafeId = localStorage.getItem('last_cafe_id');
      const savedTableNumber = localStorage.getItem('last_table_number');

      if (savedTableNumber) {
        setTableNumberState(savedTableNumber);
      }

      const hasSavedCafe = savedCafeId
        ? cafeList.some((cafe) => String(cafe.id) === String(savedCafeId))
        : false;

      if (hasSavedCafe && savedCafeId) {
        setSelectedCafeIdState(String(savedCafeId));
        return;
      }

      setSelectedCafeIdState(String(cafeList[0].id));
      if (savedCafeId) {
        localStorage.removeItem('last_cafe_id');
      }
    } catch (err: unknown) {
      console.error('Failed to load cafes:', err);
      setError(`Kafeler yüklenemedi: ${toErrorMessage(err, 'Bilinmeyen hata')}`);
    }
  }, []);

  useEffect(() => {
    void loadCafes();
  }, [loadCafes, currentUser.id]);

  const selectedCafe = useMemo(
    () => cafes.find((cafe) => String(cafe.id) === String(selectedCafeIdState)) || null,
    [cafes, selectedCafeIdState]
  );

  const maxTableCount = useMemo(
    () => Math.max(1, Number(selectedCafe?.table_count ?? selectedCafe?.total_tables ?? 20)),
    [selectedCafe]
  );

  const setSelectedCafeId = useCallback((cafeId: string) => {
    setSelectedCafeIdState(cafeId);
    setError(null);
  }, []);

  const setTableNumber = useCallback((tableNumber: string) => {
    setTableNumberState(tableNumber);
    if (error) setError(null);
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const requestLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('Tarayıcınız konum doğrulamasını desteklemiyor.');
    }

    setLocationStatus('requesting');
    const coords = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: Number(position.coords.latitude),
            longitude: Number(position.coords.longitude),
          });
        },
        (geoError) => {
          const map: Record<number, string> = {
            1: 'Konum izni reddedildi. Lütfen tarayıcıdan konum erişimine izin verin.',
            2: 'Konum bilgisi alınamadı. Lütfen GPS veya ağ konumunu kontrol edin.',
            3: 'Konum isteği zaman aşımına uğradı. Tekrar deneyin.',
          };
          reject(new Error(map[geoError.code] || 'Konum alınamadı.'));
        },
        {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 15000,
        }
      );
    });

    setLocationCoords(coords);
    setLocationStatus('ready');
    return coords;
  }, []);

  const requestLocationAccess = useCallback(async () => {
    setError(null);
    try {
      await requestLocation();
    } catch (err) {
      setLocationStatus('denied');
      setError(toErrorMessage(err, 'Konum doğrulaması başarısız.'));
    }
  }, [requestLocation]);

  const checkIn = useCallback(async () => {
    if (!selectedCafeIdState || !tableNumberState) {
      setError('Lütfen kafe ve masa numarası seçin.');
      return;
    }

    const parsedTableNumber = Number(tableNumberState);
    if (!Number.isInteger(parsedTableNumber) || parsedTableNumber < 1 || parsedTableNumber > maxTableCount) {
      setError(`Masa numarası 1 ile ${maxTableCount} arasında olmalıdır.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const coords = locationCoords || (await requestLocation());
      const result = await api.cafes.checkIn({
        cafeId: selectedCafeIdState,
        tableNumber: parsedTableNumber,
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      const resolvedCafeName = result?.cafeName || result?.cafe?.name || selectedCafe?.name || 'Kafe';
      const resolvedTable = result?.table || `MASA${String(parsedTableNumber).padStart(2, '0')}`;

      onCheckInSuccess(resolvedCafeName, resolvedTable, selectedCafeIdState);
      localStorage.setItem('last_cafe_id', selectedCafeIdState);
      localStorage.setItem('last_table_number', String(parsedTableNumber));
    } catch (err: unknown) {
      const rawMessage = toErrorMessage(err, 'Check-in başarısız.');
      const mappedMessage =
        rawMessage === 'Failed to fetch' || rawMessage === 'Load failed'
          ? 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.'
          : rawMessage;
      setError(mappedMessage);
      if (mappedMessage.toLowerCase().includes('konum')) {
        setLocationStatus('denied');
      }
    } finally {
      setLoading(false);
    }
  }, [
    locationCoords,
    maxTableCount,
    onCheckInSuccess,
    requestLocation,
    selectedCafe,
    selectedCafeIdState,
    tableNumberState,
  ]);

  return {
    cafes,
    selectedCafeId: selectedCafeIdState,
    tableNumber: tableNumberState,
    loading,
    error,
    selectedCafe,
    maxTableCount,
    locationStatus,
    setSelectedCafeId,
    setTableNumber,
    clearError,
    requestLocationAccess,
    checkIn,
  };
}
