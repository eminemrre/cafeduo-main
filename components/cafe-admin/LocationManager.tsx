import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle, LocateFixed, MapPin, Navigation, Ruler, XCircle } from 'lucide-react';
import type { CafeLocationStatus } from './types';

interface LeafletBundle {
  MapContainer: React.ComponentType<any>;
  TileLayer: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Circle: React.ComponentType<any>;
  useMapEvents: (handlers: { click?: (event: { latlng?: { lat?: number; lng?: number } }) => void }) => unknown;
}

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

interface LocationManagerProps {
  latitude: string;
  longitude: string;
  radius: string;
  secondaryLatitude: string;
  secondaryLongitude: string;
  secondaryRadius: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onRadiusChange: (value: string) => void;
  onSecondaryLatitudeChange: (value: string) => void;
  onSecondaryLongitudeChange: (value: string) => void;
  onSecondaryRadiusChange: (value: string) => void;
  onPickCurrentLocation: () => Promise<void>;
  onSubmit: () => Promise<void>;
  status: CafeLocationStatus;
  message: string;
  loading: boolean;
}

export const LocationManager: React.FC<LocationManagerProps> = ({
  latitude,
  longitude,
  radius,
  secondaryLatitude,
  secondaryLongitude,
  secondaryRadius,
  onLatitudeChange,
  onLongitudeChange,
  onRadiusChange,
  onSecondaryLatitudeChange,
  onSecondaryLongitudeChange,
  onSecondaryRadiusChange,
  onPickCurrentLocation,
  onSubmit,
  status,
  message,
  loading,
}) => {
  const [mapTarget, setMapTarget] = useState<'primary' | 'secondary'>('primary');
  const [leafletBundle, setLeafletBundle] = useState<LeafletBundle | null>(null);
  const [mapLoadError, setMapLoadError] = useState<string | null>(null);

  const primaryLat = Number(latitude);
  const primaryLng = Number(longitude);
  const secondaryLat = Number(secondaryLatitude);
  const secondaryLng = Number(secondaryLongitude);

  const primaryCoords = useMemo<[number, number] | null>(() => {
    if (!Number.isFinite(primaryLat) || !Number.isFinite(primaryLng)) return null;
    if (primaryLat < -90 || primaryLat > 90 || primaryLng < -180 || primaryLng > 180) return null;
    return [primaryLat, primaryLng];
  }, [primaryLat, primaryLng]);

  const secondaryCoords = useMemo<[number, number] | null>(() => {
    if (!Number.isFinite(secondaryLat) || !Number.isFinite(secondaryLng)) return null;
    if (secondaryLat < -90 || secondaryLat > 90 || secondaryLng < -180 || secondaryLng > 180) return null;
    return [secondaryLat, secondaryLng];
  }, [secondaryLat, secondaryLng]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (primaryCoords) return primaryCoords;
    if (secondaryCoords) return secondaryCoords;
    return [37.741000, 29.101000];
  }, [primaryCoords, secondaryCoords]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const userAgent = String(navigator?.userAgent || '').toLowerCase();
    if (userAgent.includes('jsdom')) return;

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

        const Leaflet = (leafletModule as { default?: any }).default || leafletModule;
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
          setMapLoadError('Harita yüklenemedi. Koordinat alanlarıyla devam edebilirsiniz.');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleMapPick = (lat: number, lng: number) => {
    if (mapTarget === 'secondary') {
      onSecondaryLatitudeChange(lat.toFixed(6));
      onSecondaryLongitudeChange(lng.toFixed(6));
      return;
    }
    onLatitudeChange(lat.toFixed(6));
    onLongitudeChange(lng.toFixed(6));
  };

  const leafletMap = leafletBundle;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="rf-screen-card p-8 shadow-xl">
        <p className="rf-terminal-strip mb-2">Geo Matrix</p>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <MapPin className="text-green-400" />
          Konum Doğrulama Ayarları
        </h2>

        <div className="mb-5 rf-screen-card-muted p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-cyan-200 uppercase tracking-[0.12em]">Haritadan Nokta Seç</p>
            <div className="inline-flex border border-cyan-400/30 bg-black/30">
              <button
                type="button"
                onClick={() => setMapTarget('primary')}
                className={`px-3 py-1.5 text-xs uppercase tracking-[0.1em] ${mapTarget === 'primary'
                    ? 'bg-cyan-500 text-[#041226] font-semibold'
                    : 'text-cyan-200 hover:bg-cyan-500/15'
                  }`}
              >
                Ana Konum
              </button>
              <button
                type="button"
                onClick={() => setMapTarget('secondary')}
                className={`px-3 py-1.5 text-xs uppercase tracking-[0.1em] ${mapTarget === 'secondary'
                    ? 'bg-cyan-500 text-[#041226] font-semibold'
                    : 'text-cyan-200 hover:bg-cyan-500/15'
                  }`}
              >
                İkinci Konum
              </button>
            </div>
          </div>

          {leafletMap ? (
            <div className="h-[260px] sm:h-[300px] overflow-hidden border border-cyan-400/25">
              <leafletMap.MapContainer
                key={`${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}`}
                center={mapCenter}
                zoom={15}
                scrollWheelZoom
                className="h-full w-full"
              >
                <leafletMap.TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onPick={handleMapPick} useMapEvents={leafletMap.useMapEvents} />
                {primaryCoords && (
                  <>
                    <leafletMap.Marker position={primaryCoords} />
                    <leafletMap.Circle
                      center={primaryCoords}
                      radius={Math.max(10, Number(radius) || 150)}
                      pathOptions={{ color: '#22d3ee', fillColor: '#0891b2', fillOpacity: 0.12 }}
                    />
                  </>
                )}
                {secondaryCoords && (
                  <>
                    <leafletMap.Marker position={secondaryCoords} />
                    <leafletMap.Circle
                      center={secondaryCoords}
                      radius={Math.max(10, Number(secondaryRadius) || 150)}
                      pathOptions={{ color: '#f0abfc', fillColor: '#a21caf', fillOpacity: 0.12 }}
                    />
                  </>
                )}
              </leafletMap.MapContainer>
            </div>
          ) : (
            <div className="h-[130px] border border-cyan-500/25 bg-cyan-950/20 flex items-center justify-center text-sm text-cyan-200/80 px-4 text-center">
              {mapLoadError || 'Harita yükleniyor...'}
            </div>
          )}

          <p className="text-xs text-[var(--rf-muted)]">
            Haritada tıkladığınız nokta, seçili hedefe ({mapTarget === 'primary' ? 'ana konum' : 'ikinci konum'}) otomatik yazılır.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label htmlFor="cafe-lat-input" className="block text-sm font-medium text-[var(--rf-muted)] mb-2 uppercase tracking-[0.08em]">
              Enlem (Latitude)
            </label>
            <div className="relative">
              <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-muted)]" />
              <input
                id="cafe-lat-input"
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(event) => onLatitudeChange(event.target.value)}
                placeholder="37.741000"
                className="rf-input w-full pl-10 pr-4 py-3 text-white placeholder:text-[var(--rf-muted)] outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cafe-lng-input" className="block text-sm font-medium text-[var(--rf-muted)] mb-2 uppercase tracking-[0.08em]">
              Boylam (Longitude)
            </label>
            <div className="relative">
              <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-muted)] rotate-90" />
              <input
                id="cafe-lng-input"
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(event) => onLongitudeChange(event.target.value)}
                placeholder="29.101000"
                className="rf-input w-full pl-10 pr-4 py-3 text-white placeholder:text-[var(--rf-muted)] outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cafe-radius-input" className="block text-sm font-medium text-[var(--rf-muted)] mb-2 uppercase tracking-[0.08em]">
              Doğrulama Yarıçapı (metre)
            </label>
            <div className="relative">
              <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-muted)]" />
              <input
                id="cafe-radius-input"
                type="number"
                min="10"
                max="5000"
                value={radius}
                onChange={(event) => onRadiusChange(event.target.value)}
                placeholder="150"
                className="rf-input w-full pl-10 pr-4 py-3 text-white placeholder:text-[var(--rf-muted)] outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-cyan-500/20 space-y-4">
            <p className="text-sm font-semibold text-cyan-200">İkinci Konum (Opsiyonel)</p>
            <div>
              <label htmlFor="cafe-secondary-lat-input" className="block text-sm font-medium text-[var(--rf-muted)] mb-2 uppercase tracking-[0.08em]">
                Ek Enlem (Latitude)
              </label>
              <div className="relative">
                <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-muted)]" />
                <input
                  id="cafe-secondary-lat-input"
                  type="number"
                  step="0.000001"
                  value={secondaryLatitude}
                  onChange={(event) => onSecondaryLatitudeChange(event.target.value)}
                  placeholder="37.742000"
                  className="rf-input w-full pl-10 pr-4 py-3 text-white placeholder:text-[var(--rf-muted)] outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cafe-secondary-lng-input" className="block text-sm font-medium text-[var(--rf-muted)] mb-2 uppercase tracking-[0.08em]">
                Ek Boylam (Longitude)
              </label>
              <div className="relative">
                <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-muted)] rotate-90" />
                <input
                  id="cafe-secondary-lng-input"
                  type="number"
                  step="0.000001"
                  value={secondaryLongitude}
                  onChange={(event) => onSecondaryLongitudeChange(event.target.value)}
                  placeholder="29.102000"
                  className="rf-input w-full pl-10 pr-4 py-3 text-white placeholder:text-[var(--rf-muted)] outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cafe-secondary-radius-input" className="block text-sm font-medium text-[var(--rf-muted)] mb-2 uppercase tracking-[0.08em]">
                Ek Konum Yarıçapı (metre)
              </label>
              <div className="relative">
                <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--rf-muted)]" />
                <input
                  id="cafe-secondary-radius-input"
                  type="number"
                  min="10"
                  max="5000"
                  value={secondaryRadius}
                  onChange={(event) => onSecondaryRadiusChange(event.target.value)}
                  placeholder="150"
                  className="rf-input w-full pl-10 pr-4 py-3 text-white placeholder:text-[var(--rf-muted)] outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => void onPickCurrentLocation()}
              className="py-3 border-2 border-cyan-500/35 bg-cyan-900/20 text-cyan-100 hover:bg-cyan-900/35 font-semibold flex items-center justify-center gap-2"
            >
              <LocateFixed size={16} />
              Cihazdan Konumu Al
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`py-3 border-2 font-bold text-white flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-cyan-950/55 text-[var(--rf-muted)] cursor-not-allowed border-cyan-900/45' : 'bg-green-600 hover:bg-green-500 border-green-300/40'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <MapPin size={18} />
                  KONUMU KAYDET
                </>
              )}
            </button>
          </div>
        </form>

        {status !== 'idle' && (
          <div
            className={`mt-6 p-4 border flex items-center gap-3 ${
              status === 'success'
                ? 'bg-green-900/20 border-green-900/50 text-green-400'
                : 'bg-red-900/20 border-red-900/50 text-red-400'
            }`}
            role="status"
            aria-live="polite"
          >
            {status === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <p className="font-medium">{message}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 text-sm text-blue-300">
          <p className="font-bold mb-2">Not:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-400/80">
            <li>Check-in yalnızca bu konum yarıçapı içinde yapılabilir.</li>
            <li>Yarıçapı kampüs/kat sınırlarına göre güncelleyin.</li>
            <li>Konum güncellendiğinde kullanıcılar bir sonraki girişte yeni kurala göre doğrulanır.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
