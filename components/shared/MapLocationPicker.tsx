/**
 * MapLocationPicker — shared Riso Kantin map picker for cafe location editing.
 *
 * Renders a Leaflet map with:
 *   - A target switcher (Primary / Secondary location pair)
 *   - Click-to-pick: clicking the map writes lat/lng (6 decimal places) into
 *     the currently selected target slot via the supplied setters
 *   - Visual ring for each location showing its check-in radius
 *
 * The component is purely the map; the lat/lng/radius **inputs** themselves
 * remain in the parent so callers can pick their own layout. The shared map
 * keeps Leaflet's loading + tile-attribution + Riso colour scheme in one
 * place so both AdminDashboard's cafe editor and cafe-admin's
 * LocationManager stay in sync.
 *
 * Leaflet is loaded dynamically (no top-level import) so the bundle doesn't
 * pay the cost on pages that don't need a map. The leaflet.css link is
 * injected once per session via an id-marked <link> in <head>.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, Search, Trash2 } from 'lucide-react';
import { searchAddresses, type GeocodingResult } from '../../lib/geocoding';

type LeafletBundle = {
  MapContainer: typeof import('react-leaflet').MapContainer;
  TileLayer: typeof import('react-leaflet').TileLayer;
  Marker: typeof import('react-leaflet').Marker;
  Circle: typeof import('react-leaflet').Circle;
  useMapEvents: typeof import('react-leaflet').useMapEvents;
};

/** Internal — wires Leaflet's click events into our pick callback. Lives
 *  inside the map's React tree so it can call useMapEvents safely. */
const MapClickHandler: React.FC<{
  onPick: (lat: number, lng: number) => void;
  useMapEvents: LeafletBundle['useMapEvents'];
}> = ({ onPick, useMapEvents }) => {
  useMapEvents({
    click: (event) => {
      const lat = Number(event?.latlng?.lat);
      const lng = Number(event?.latlng?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onPick(lat, lng);
    },
  });
  return null;
};

interface MapLocationPickerProps {
  /** Primary location latitude as string ('' if unset) — uses string so
   *  caller's controlled input pattern matches without converting. */
  primaryLatitude: string;
  primaryLongitude: string;
  /** Numeric radius in metres for the primary location ring. */
  primaryRadius: number;

  /** Optional secondary location pair. Omit/leave empty to hide the
   *  secondary target switch and skip rendering the second ring. */
  secondaryLatitude?: string;
  secondaryLongitude?: string;
  secondaryRadius?: number;

  onPrimaryLatitudeChange: (value: string) => void;
  onPrimaryLongitudeChange: (value: string) => void;
  onPrimaryCoordinatesChange?: (latitude: string, longitude: string) => void;
  onPrimaryRadiusChange: (value: string) => void;
  onSecondaryLatitudeChange?: (value: string) => void;
  onSecondaryLongitudeChange?: (value: string) => void;
  onSecondaryCoordinatesChange?: (latitude: string, longitude: string) => void;
  onSecondaryRadiusChange?: (value: string) => void;

  /** If true, the secondary location switch is shown. Default: true if any
   *  of the secondary props are provided. */
  enableSecondary?: boolean;

  /** Address search and browser geolocation can be disabled for constrained embeds. */
  enableSearch?: boolean;
  enableGeolocation?: boolean;

  /** Height of the map area. Default: responsive (260px → 300px sm+). */
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [37.741, 29.101]; // Pamukkale Üniversitesi

export const MapLocationPicker: React.FC<MapLocationPickerProps> = ({
  primaryLatitude,
  primaryLongitude,
  primaryRadius,
  secondaryLatitude = '',
  secondaryLongitude = '',
  secondaryRadius = 150,
  onPrimaryLatitudeChange,
  onPrimaryLongitudeChange,
  onPrimaryCoordinatesChange,
  onPrimaryRadiusChange,
  onSecondaryLatitudeChange,
  onSecondaryLongitudeChange,
  onSecondaryCoordinatesChange,
  onSecondaryRadiusChange,
  enableSecondary,
  enableSearch = true,
  enableGeolocation = true,
  className = '',
}) => {
  const allowSecondary =
    enableSecondary ?? Boolean(onSecondaryLatitudeChange && onSecondaryLongitudeChange);

  const [mapTarget, setMapTarget] = useState<'primary' | 'secondary'>('primary');
  const [leafletBundle, setLeafletBundle] = useState<LeafletBundle | null>(null);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [interactionMessage, setInteractionMessage] = useState('');
  const searchAbortRef = useRef<AbortController | null>(null);

  const primaryLat = Number(primaryLatitude);
  const primaryLng = Number(primaryLongitude);
  const secondaryLat = Number(secondaryLatitude);
  const secondaryLng = Number(secondaryLongitude);

  const primaryCoords = useMemo<[number, number] | null>(() => {
    if (!Number.isFinite(primaryLat) || !Number.isFinite(primaryLng)) return null;
    if (primaryLat < -90 || primaryLat > 90 || primaryLng < -180 || primaryLng > 180) return null;
    return [primaryLat, primaryLng];
  }, [primaryLat, primaryLng]);

  const secondaryCoords = useMemo<[number, number] | null>(() => {
    if (!allowSecondary) return null;
    if (!Number.isFinite(secondaryLat) || !Number.isFinite(secondaryLng)) return null;
    if (secondaryLat < -90 || secondaryLat > 90 || secondaryLng < -180 || secondaryLng > 180) {
      return null;
    }
    return [secondaryLat, secondaryLng];
  }, [allowSecondary, secondaryLat, secondaryLng]);

  // Recenter the map when the active target gets a fresh coordinate. Stable
  // string key avoids constant rerenders while coordinates are typed digit by
  // digit (re-keying remounts the MapContainer, expensive).
  const mapCenter = useMemo<[number, number]>(() => {
    if (mapTarget === 'secondary' && secondaryCoords) return secondaryCoords;
    if (primaryCoords) return primaryCoords;
    if (secondaryCoords) return secondaryCoords;
    return DEFAULT_CENTER;
  }, [mapTarget, primaryCoords, secondaryCoords]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const userAgent = String(navigator?.userAgent || '').toLowerCase();
    if (userAgent.includes('jsdom')) return;

    // Inject leaflet.css once. Marked with an id so duplicate mounts (e.g.
    // admin + cafe-admin in the same SPA session) don't re-add the tag.
    const existingCss = document.getElementById('leaflet-style-cafeduo');
    if (!existingCss) {
      const link = document.createElement('link');
      link.id = 'leaflet-style-cafeduo';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    let isMounted = true;
    void Promise.all([import('react-leaflet'), import('leaflet')])
      .then(([reactLeaflet, leafletModule]) => {
        if (!isMounted) return;

        const leafletNs = leafletModule as typeof import('leaflet');
        const Leaflet = (leafletNs as { default?: typeof import('leaflet') }).default || leafletNs;
        const defaultIcon = Leaflet.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        Leaflet.Marker.prototype.options.icon = defaultIcon;

        setLeafletBundle({
          MapContainer: reactLeaflet.MapContainer,
          TileLayer: reactLeaflet.TileLayer,
          Marker: reactLeaflet.Marker,
          Circle: reactLeaflet.Circle,
          useMapEvents: reactLeaflet.useMapEvents,
        });
      })
      .catch((error) => {
        console.error('Leaflet map load failed', error);
        if (isMounted) {
          setMapLoadError('Harita yüklenemedi. Koordinatları elle girerek devam edebilirsiniz.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      searchAbortRef.current?.abort();
    },
    []
  );

  const emitCoordinates = (latitude: number, longitude: number) => {
    const formattedLatitude = latitude.toFixed(6);
    const formattedLongitude = longitude.toFixed(6);
    if (mapTarget === 'secondary' && allowSecondary) {
      if (onSecondaryCoordinatesChange) {
        onSecondaryCoordinatesChange(formattedLatitude, formattedLongitude);
      } else {
        onSecondaryLatitudeChange?.(formattedLatitude);
        onSecondaryLongitudeChange?.(formattedLongitude);
      }
      return;
    }
    if (onPrimaryCoordinatesChange) {
      onPrimaryCoordinatesChange(formattedLatitude, formattedLongitude);
    } else {
      onPrimaryLatitudeChange(formattedLatitude);
      onPrimaryLongitudeChange(formattedLongitude);
    }
  };

  const handleMapPick = (lat: number, lng: number) => {
    emitCoordinates(lat, lng);
  };

  const activeTargetName = mapTarget === 'secondary' ? 'İkinci konum' : 'Ana konum';
  const activeRadius = mapTarget === 'secondary' ? secondaryRadius : primaryRadius;

  const applyCoordinates = (latitude: number, longitude: number) => {
    emitCoordinates(latitude, longitude);
  };

  const handleSearch = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearchLoading(true);
    setSearchResults([]);
    setInteractionMessage('Adres aranıyor...');

    try {
      const results = await searchAddresses(searchQuery, controller.signal);
      if (controller.signal.aborted) return;
      setSearchResults(results);
      setInteractionMessage(
        results.length > 0 ? `${results.length} sonuç bulundu.` : 'Adres bulunamadı.'
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setInteractionMessage(error instanceof Error ? error.message : 'Adres araması başarısız.');
    } finally {
      if (!controller.signal.aborted) setSearchLoading(false);
    }
  };

  const handleSearchResult = (result: GeocodingResult) => {
    applyCoordinates(result.latitude, result.longitude);
    setSearchQuery(result.displayName);
    setSearchResults([]);
    setInteractionMessage(`${activeTargetName} güncellendi.`);
  };

  const handleUseDeviceLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setInteractionMessage('Bu tarayıcı cihaz konumunu desteklemiyor.');
      return;
    }

    setInteractionMessage('Cihaz konumu alınıyor...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          setInteractionMessage('Cihaz konumu geçersiz döndü.');
          return;
        }
        applyCoordinates(latitude, longitude);
        setInteractionMessage(`${activeTargetName} cihaz konumundan alındı.`);
      },
      (error) => {
        const messageByCode: Record<number, string> = {
          1: 'Konum izni reddedildi. Tarayıcı ayarlarından izin verin.',
          2: 'Cihaz konumu alınamadı.',
          3: 'Konum isteği zaman aşımına uğradı.',
        };
        setInteractionMessage(messageByCode[error.code] || 'Cihaz konumu alınamadı.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleRadiusChange = (value: string) => {
    if (mapTarget === 'secondary' && allowSecondary) {
      onSecondaryRadiusChange?.(value);
      return;
    }
    onPrimaryRadiusChange(value);
  };

  const handleClear = () => {
    if (mapTarget === 'secondary' && allowSecondary) {
      onSecondaryLatitudeChange?.('');
      onSecondaryLongitudeChange?.('');
      onSecondaryRadiusChange?.('150');
    } else {
      onPrimaryLatitudeChange('');
      onPrimaryLongitudeChange('');
      onPrimaryRadiusChange('150');
    }
    setInteractionMessage(`${activeTargetName} temizlendi.`);
  };

  const Leaflet = leafletBundle;

  return (
    <div className={`bg-paper-deep p-4 space-y-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-carbon-soft font-riso-body">
          Haritaya tıkladığın nokta seçili konuma yazılır.
        </p>
        {allowSecondary && (
          <div className="flex gap-5" role="group" aria-label="Haritadaki hedef">
            <button
              type="button"
              onClick={() => setMapTarget('primary')}
              aria-pressed={mapTarget === 'primary'}
              className={`riso-focus min-h-11 text-[0.9375rem] font-semibold transition-[color,box-shadow] ${
                mapTarget === 'primary'
                  ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]'
                  : 'text-carbon-muted hover:text-carbon'
              }`}
            >
              Ana konum
            </button>
            <button
              type="button"
              onClick={() => setMapTarget('secondary')}
              aria-pressed={mapTarget === 'secondary'}
              className={`riso-focus min-h-11 text-[0.9375rem] font-semibold transition-[color,box-shadow] ${
                mapTarget === 'secondary'
                  ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]'
                  : 'text-carbon-muted hover:text-carbon'
              }`}
            >
              İkinci konum
            </button>
          </div>
        )}
      </div>

      {(enableSearch || enableGeolocation) && (
        <div className="space-y-3">
          {enableSearch && (
            <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="location-search" className="sr-only">
                Adres ara
              </label>
              <input
                id="location-search"
                type="search"
                role="searchbox"
                aria-label="Adres ara"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Adres, kampüs veya kafe ara..."
                className="duo-input min-w-0 flex-1 px-3 text-base text-carbon placeholder:text-carbon-muted riso-focus"
              />
              <button
                type="submit"
                disabled={searchLoading || !searchQuery.trim()}
                className="riso-focus inline-flex min-h-[52px] items-center justify-center gap-2 bg-carbon px-4 text-[0.9375rem] font-semibold text-paper transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Search size={15} />
                {searchLoading ? 'Aranıyor...' : 'Adres ara'}
              </button>
            </form>
          )}

          <div className="flex flex-wrap gap-2">
            {enableGeolocation && (
              <button
                type="button"
                onClick={handleUseDeviceLocation}
                className="duo-quiet riso-focus gap-2"
              >
                <LocateFixed size={15} />
                Cihaz konumumu kullan
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="duo-quiet riso-focus gap-2"
              aria-label={`${activeTargetName === 'Ana konum' ? 'Ana konumu' : 'İkinci konumu'} temizle`}
            >
              <Trash2 size={15} />
              Temizle
            </button>
          </div>

          {searchResults.length > 0 && (
            <ul
              role="listbox"
              aria-label="Adres sonuçları"
              className="max-h-48 overflow-y-auto bg-paper"
            >
              {searchResults.map((result) => (
                <li key={result.placeId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    onClick={() => handleSearchResult(result)}
                    className="w-full min-h-11 border-b border-paper-dim px-3 py-2 text-left text-sm text-carbon last:border-b-0 hover:bg-paper-dim focus:bg-paper-dim focus:outline-none"
                  >
                    {result.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p role="status" aria-live="polite" className="text-[0.8125rem] text-carbon-soft">
            {interactionMessage || 'Adres ara, cihaz konumunu kullan veya haritaya tıkla.'}
          </p>
        </div>
      )}

      {Leaflet ? (
        <div className="h-[260px] sm:h-[300px] overflow-hidden">
          <Leaflet.MapContainer
            key={`${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}`}
            center={mapCenter}
            zoom={15}
            scrollWheelZoom
            className="h-full w-full"
          >
            <Leaflet.TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onPick={handleMapPick} useMapEvents={Leaflet.useMapEvents} />
            {primaryCoords && (
              <>
                <Leaflet.Marker position={primaryCoords} />
                <Leaflet.Circle
                  center={primaryCoords}
                  radius={Math.max(10, Number(primaryRadius) || 150)}
                  pathOptions={{ color: '#0b6aa8', fillColor: '#1fb3ff', fillOpacity: 0.2 }}
                />
              </>
            )}
            {secondaryCoords && (
              <>
                <Leaflet.Marker position={secondaryCoords} />
                <Leaflet.Circle
                  center={secondaryCoords}
                  radius={Math.max(10, Number(secondaryRadius) || 150)}
                  pathOptions={{ color: '#c4265f', fillColor: '#ff5c8a', fillOpacity: 0.2 }}
                />
              </>
            )}
          </Leaflet.MapContainer>
        </div>
      ) : (
        <div className="h-[130px] bg-paper-dim flex items-center justify-center text-sm text-carbon-soft px-4 text-center font-riso-body">
          {mapLoadError || 'Harita yükleniyor...'}
        </div>
      )}

      <div className="bg-paper p-3">
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor="location-radius-slider"
            className="text-[0.9375rem] font-medium text-carbon"
          >
            {activeTargetName} yarıçapı
          </label>
          <span className="text-[0.9375rem] font-semibold text-carbon [font-variant-numeric:tabular-nums]">
            {Number(activeRadius) || 150} m
          </span>
        </div>
        <input
          id="location-radius-slider"
          type="range"
          min="10"
          max="5000"
          step="10"
          value={Number(activeRadius) || 150}
          onChange={(event) => handleRadiusChange(event.target.value)}
          aria-label={`${activeTargetName} yarıçapı`}
          className="mt-3 w-full accent-[#17140f]"
        />
        <div className="mt-1 flex justify-between text-[0.8125rem] text-carbon-soft [font-variant-numeric:tabular-nums]">
          <span>10 m</span>
          <span>5000 m</span>
        </div>
      </div>

      <p className="text-[0.8125rem] text-carbon-soft font-riso-body">
        Haritada tıkladığın nokta, seçili hedefe (
        {mapTarget === 'primary' ? 'ana konum' : 'ikinci konum'}) otomatik yazılır. Yarıçap halkası
        içinde kalan kullanıcılar check-in yapabilir.
      </p>
    </div>
  );
};

export default MapLocationPicker;
