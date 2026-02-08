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
  pin: string;
  loading: boolean;
  error: string | null;
  selectedCafe: Cafe | null;
  maxTableCount: number;
  isPinValid: boolean;
  setSelectedCafeId: (cafeId: string) => void;
  setTableNumber: (tableNumber: string) => void;
  setPin: (pin: string) => void;
  clearError: () => void;
  checkIn: () => Promise<void>;
}

const toErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

/**
 * useCafeSelection Hook
 *
 * @description Kafe listesi, masa/PIN doğrulama ve check-in akışını yönetir.
 * UI bileşeni yalnızca sunum katmanını taşır.
 */
export function useCafeSelection({
  currentUser,
  onCheckInSuccess,
}: UseCafeSelectionProps): UseCafeSelectionReturn {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [selectedCafeIdState, setSelectedCafeIdState] = useState<string | null>(null);
  const [tableNumberState, setTableNumberState] = useState<string>('');
  const [pinState, setPinState] = useState<string>('');
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

  const isPinValid = useMemo(() => pinState.length >= 4, [pinState]);

  const setSelectedCafeId = useCallback((cafeId: string) => {
    setSelectedCafeIdState(cafeId);
    setPinState('');
    setError(null);
  }, []);

  const setTableNumber = useCallback((tableNumber: string) => {
    setTableNumberState(tableNumber);
    if (error) setError(null);
  }, [error]);

  const setPin = useCallback((pin: string) => {
    setPinState(pin.replace(/\D/g, '').slice(0, 4));
    if (error) setError(null);
  }, [error]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const checkIn = useCallback(async () => {
    if (!selectedCafeIdState || !tableNumberState) {
      setError('Lütfen kafe ve masa numarası seçin.');
      return;
    }

    if (!isPinValid) {
      setError('PIN kodu 4 haneli olmalıdır.');
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
      const result = await api.cafes.checkIn({
        cafeId: selectedCafeIdState,
        tableNumber: parsedTableNumber,
        pin: pinState,
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
      setPinState('');
    } finally {
      setLoading(false);
    }
  }, [
    isPinValid,
    maxTableCount,
    onCheckInSuccess,
    pinState,
    selectedCafe,
    selectedCafeIdState,
    tableNumberState,
  ]);

  return {
    cafes,
    selectedCafeId: selectedCafeIdState,
    tableNumber: tableNumberState,
    pin: pinState,
    loading,
    error,
    selectedCafe,
    maxTableCount,
    isPinValid,
    setSelectedCafeId,
    setTableNumber,
    setPin,
    clearError,
    checkIn,
  };
}
