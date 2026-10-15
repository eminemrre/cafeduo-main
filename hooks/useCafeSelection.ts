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
  tableVerificationCode: string;
  loading: boolean;
  error: string | null;
  selectedCafe: Cafe | null;
  maxTableCount: number;
  locationStatus: 'idle' | 'requesting' | 'ready' | 'denied';
  setSelectedCafeId: (cafeId: string) => void;
  setTableNumber: (tableNumber: string) => void;
  setTableVerificationCode: (code: string) => void;
  clearError: () => void;
  requestLocationAccess: () => Promise<void>;
  checkIn: () => Promise<void>;
}

const toErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface GeoErrorLike {
  code?: number;
}

type GeoPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

/**
 * Probe the browser-level geolocation permission state via the Permissions API.
 * On mobile devices users frequently grant the browser permission but the
 * underlying OS-level location service is off, in which case `getCurrentPosition`
 * returns `code: 1` (PERMISSION_DENIED) anyway. By reading the actual permission
 * state we can show a more accurate error message.
 *
 * Returns 'unsupported' on older browsers / non-secure contexts where
 * `navigator.permissions.query` is missing or rejects.
 */
const probePermissionState = async (): Promise<GeoPermissionState> => {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported';
  }
  try {
    const result = await navigator.permissions.query({
      name: 'geolocation' as PermissionName,
    });
    return result.state as Exclude<GeoPermissionState, 'unsupported'>;
  } catch {
    return 'unsupported';
  }
};

/**
 * Produce a user-facing error message that reflects the most likely root cause
 * given the GeolocationPositionError code AND the browser permission state.
 *
 * The catch in the original implementation: a `code: 1` (PERMISSION_DENIED)
 * does not always mean the user denied the browser prompt. On iOS Safari the
 * same code is returned when system-level Location Services are off; on
 * Android Chrome when the global location toggle is off. Telling those users
 * "browser permission denied" sends them to the wrong setting screen.
 */
const getGeoErrorMessage = (
  geoError: GeoErrorLike,
  permissionState: GeoPermissionState
): string => {
  // code 1 + permission already 'granted' => the OS or device is blocking,
  // not the browser. Steer the user to the right setting.
  if (geoError.code === 1 && permissionState === 'granted') {
    return (
      'Tarayıcı konum izni verilmiş ama cihazınız konumu paylaşmıyor. ' +
      'iOS: Ayarlar → Gizlilik → Konum Servisleri açık olmalı. ' +
      'Android: Hızlı ayarlardan Konum açık olmalı. ' +
      'Alternatif: Masa Doğrulama Kodunu girip devam edebilirsin.'
    );
  }

  const map: Record<number, string> = {
    1: 'Konum izni reddedildi. Lütfen tarayıcıdan konum erişimine izin verin. Alternatif olarak Masa Doğrulama Kodunu kullanabilirsin.',
    2: 'Konum bilgisi alınamadı. Lütfen GPS veya ağ konumunu kontrol edin. Alternatif olarak Masa Doğrulama Kodunu kullanabilirsin.',
    3: 'Konum isteği zaman aşımına uğradı. Cihaz konum servisinizin açık olduğundan emin olup tekrar deneyin. Alternatif olarak Masa Doğrulama Kodunu kullanabilirsin.',
  };
  return map[geoError.code ?? 0] || 'Konum alınamadı.';
};

const toLocationCoords = (position: GeolocationPosition): LocationCoords => ({
  latitude: Number(position.coords.latitude),
  longitude: Number(position.coords.longitude),
  accuracy: Number.isFinite(position.coords.accuracy) ? Number(position.coords.accuracy) : 0,
});

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
  const [tableVerificationCodeState, setTableVerificationCodeState] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>(
    'idle'
  );
  const [locationCoords, setLocationCoords] = useState<LocationCoords | null>(null);
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

  const setTableNumber = useCallback(
    (tableNumber: string) => {
      setTableNumberState(tableNumber);
      if (error) setError(null);
    },
    [error]
  );

  const setTableVerificationCode = useCallback(
    (code: string) => {
      setTableVerificationCodeState(code);
      if (error) setError(null);
    },
    [error]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const requestLocation = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new Error('Tarayıcınız konum doğrulamasını desteklemiyor.');
    }

    setLocationStatus('requesting');

    // Probe the actual permission state up front so we can produce accurate
    // error messages later — see getGeoErrorMessage docstring for why code 1
    // alone is misleading on mobile devices.
    const permissionState = await probePermissionState();

    const getPosition = (options: PositionOptions) =>
      new Promise<LocationCoords>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(toLocationCoords(position)),
          (geoError) => reject(geoError),
          options
        );
      });

    // Desktop tarayıcılarda high-accuracy sık timeout verdiği için önce hızlı/coarse deniyoruz.
    try {
      const coarseCoords = await getPosition({
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 120000,
      });
      setLocationCoords(coarseCoords);
      setLocationStatus('ready');
      return coarseCoords;
    } catch (coarseError: unknown) {
      const geoError = (
        typeof coarseError === 'object' && coarseError !== null ? coarseError : {}
      ) as GeoErrorLike;
      if (geoError.code === 1) {
        throw new Error(getGeoErrorMessage(geoError, permissionState));
      }
    }

    const coords = await getPosition({
      enableHighAccuracy: true,
      timeout: 16000,
      maximumAge: 15000,
    }).catch(async (preciseError: unknown) => {
      const geoError = (
        typeof preciseError === 'object' && preciseError !== null ? preciseError : {}
      ) as GeoErrorLike;
      if (geoError.code === 1) {
        throw new Error(getGeoErrorMessage(geoError, permissionState));
      }

      // Özellikle masaüstünde GPS hassas modu timeout verdiğinde
      // ağ tabanlı lokasyonla son bir deneme yapıyoruz.
      try {
        return await getPosition({
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 600000,
        });
      } catch (fallbackError: unknown) {
        const fallbackGeoError = (
          typeof fallbackError === 'object' && fallbackError !== null ? fallbackError : {}
        ) as GeoErrorLike;
        throw new Error(getGeoErrorMessage(fallbackGeoError, permissionState));
      }
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
    if (
      !Number.isInteger(parsedTableNumber) ||
      parsedTableNumber < 1 ||
      parsedTableNumber > maxTableCount
    ) {
      setError(`Masa numarası 1 ile ${maxTableCount} arasında olmalıdır.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const normalizedVerificationCode = String(tableVerificationCodeState || '').trim();
      let coords: LocationCoords | null = null;
      if (!normalizedVerificationCode) {
        coords = locationCoords;
        try {
          // Refresh GPS only when it is the chosen verification method.
          coords = await requestLocation();
        } catch (geoErr) {
          if (!coords) {
            throw geoErr;
          }
        }
      }
      // Code verification must omit cached coordinates: the server prioritizes
      // geofencing whenever coordinates are supplied. It validates the code otherwise.
      if (!coords && !normalizedVerificationCode) {
        throw new Error('Konum alınamadı. Masa doğrulama kodunu girip tekrar deneyin.');
      }
      const result = await api.cafes.checkIn({
        cafeId: selectedCafeIdState,
        tableNumber: parsedTableNumber,
        ...(coords
          ? {
              latitude: coords.latitude,
              longitude: coords.longitude,
              accuracy: coords.accuracy,
            }
          : {}),
        ...(normalizedVerificationCode
          ? { tableVerificationCode: normalizedVerificationCode }
          : {}),
      });

      const resolvedCafeName =
        result?.cafeName || result?.cafe?.name || selectedCafe?.name || 'Kafe';
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
    tableVerificationCodeState,
    tableNumberState,
  ]);

  return {
    cafes,
    selectedCafeId: selectedCafeIdState,
    tableNumber: tableNumberState,
    tableVerificationCode: tableVerificationCodeState,
    loading,
    error,
    selectedCafe,
    maxTableCount,
    locationStatus,
    setSelectedCafeId,
    setTableNumber,
    setTableVerificationCode,
    clearError,
    requestLocationAccess,
    checkIn,
  };
}
