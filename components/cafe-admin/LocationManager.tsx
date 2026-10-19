import React from 'react';
import { CheckCircle, LocateFixed, MapPin, Navigation, Ruler, XCircle } from 'lucide-react';
import type { CafeLocationStatus } from './types';
import { MapLocationPicker } from '../shared/MapLocationPicker';

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
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-paper p-8">
        <h2 className="font-riso-display text-[1.75rem] leading-none text-carbon mb-6 flex items-center gap-2">
          <MapPin aria-hidden="true" />
          Konum doğrulama ayarları
        </h2>

        <div className="mb-5">
          <MapLocationPicker
            primaryLatitude={latitude}
            primaryLongitude={longitude}
            primaryRadius={Number(radius) || 150}
            secondaryLatitude={secondaryLatitude}
            secondaryLongitude={secondaryLongitude}
            secondaryRadius={Number(secondaryRadius) || 150}
            onPrimaryLatitudeChange={onLatitudeChange}
            onPrimaryLongitudeChange={onLongitudeChange}
            onPrimaryCoordinatesChange={(nextLatitude, nextLongitude) => {
              onLatitudeChange(nextLatitude);
              onLongitudeChange(nextLongitude);
            }}
            onPrimaryRadiusChange={onRadiusChange}
            onSecondaryLatitudeChange={onSecondaryLatitudeChange}
            onSecondaryLongitudeChange={onSecondaryLongitudeChange}
            onSecondaryCoordinatesChange={(nextLatitude, nextLongitude) => {
              onSecondaryLatitudeChange(nextLatitude);
              onSecondaryLongitudeChange(nextLongitude);
            }}
            onSecondaryRadiusChange={onSecondaryRadiusChange}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label
              htmlFor="cafe-lat-input"
              className="block text-[0.9375rem] font-medium text-carbon mb-2"
            >
              Enlem (Latitude)
            </label>
            <div className="relative">
              <Navigation
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted"
              />
              <input
                id="cafe-lat-input"
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(event) => onLatitudeChange(event.target.value)}
                placeholder="37.741000"
                className="duo-input riso-focus w-full pl-10 pr-4 text-base text-carbon placeholder:text-carbon-muted [font-variant-numeric:tabular-nums] focus:bg-paper"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cafe-lng-input"
              className="block text-[0.9375rem] font-medium text-carbon mb-2"
            >
              Boylam (Longitude)
            </label>
            <div className="relative">
              <Navigation
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted rotate-90"
              />
              <input
                id="cafe-lng-input"
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(event) => onLongitudeChange(event.target.value)}
                placeholder="29.101000"
                className="duo-input riso-focus w-full pl-10 pr-4 text-base text-carbon placeholder:text-carbon-muted [font-variant-numeric:tabular-nums] focus:bg-paper"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="cafe-radius-input"
              className="block text-[0.9375rem] font-medium text-carbon mb-2"
            >
              Doğrulama Yarıçapı (metre)
            </label>
            <div className="relative">
              <Ruler
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted"
              />
              <input
                id="cafe-radius-input"
                type="number"
                min="10"
                max="5000"
                value={radius}
                onChange={(event) => onRadiusChange(event.target.value)}
                placeholder="150"
                className="duo-input riso-focus w-full pl-10 pr-4 text-base text-carbon placeholder:text-carbon-muted [font-variant-numeric:tabular-nums] focus:bg-paper"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-riso-blue/20 space-y-4">
            <p className="text-[0.9375rem] font-semibold text-carbon">İkinci konum <span className="font-normal text-carbon-soft">(isteğe bağlı)</span></p>
            <div>
              <label
                htmlFor="cafe-secondary-lat-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2"
              >
                Ek Enlem (Latitude)
              </label>
              <div className="relative">
                <Navigation
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted"
                />
                <input
                  id="cafe-secondary-lat-input"
                  type="number"
                  step="0.000001"
                  value={secondaryLatitude}
                  onChange={(event) => onSecondaryLatitudeChange(event.target.value)}
                  placeholder="37.742000"
                  className="duo-input riso-focus w-full pl-10 pr-4 text-base text-carbon placeholder:text-carbon-muted [font-variant-numeric:tabular-nums] focus:bg-paper"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="cafe-secondary-lng-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2"
              >
                Ek Boylam (Longitude)
              </label>
              <div className="relative">
                <Navigation
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted rotate-90"
                />
                <input
                  id="cafe-secondary-lng-input"
                  type="number"
                  step="0.000001"
                  value={secondaryLongitude}
                  onChange={(event) => onSecondaryLongitudeChange(event.target.value)}
                  placeholder="29.102000"
                  className="duo-input riso-focus w-full pl-10 pr-4 text-base text-carbon placeholder:text-carbon-muted [font-variant-numeric:tabular-nums] focus:bg-paper"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="cafe-secondary-radius-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2"
              >
                Ek Konum Yarıçapı (metre)
              </label>
              <div className="relative">
                <Ruler
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-carbon-muted"
                />
                <input
                  id="cafe-secondary-radius-input"
                  type="number"
                  min="10"
                  max="5000"
                  value={secondaryRadius}
                  onChange={(event) => onSecondaryRadiusChange(event.target.value)}
                  placeholder="150"
                  className="duo-input riso-focus w-full pl-10 pr-4 text-base text-carbon placeholder:text-carbon-muted [font-variant-numeric:tabular-nums] focus:bg-paper"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => void onPickCurrentLocation()}
              className="riso-focus py-3 bg-paper-deep text-carbon hover:bg-paper font-riso-body font-bold flex items-center justify-center gap-2 text-sm"
            >
              <LocateFixed size={16} />
              Cihazdan Konumu Al
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`riso-focus py-3 font-riso-body font-bold flex items-center justify-center gap-2 transition-all text-sm ${ loading ? 'bg-paper-dim text-carbon-muted cursor-not-allowed' : 'bg-riso-pink text-carbon' }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-t-transparent animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <MapPin size={18} />
                  Konumu kaydet
                </>
              )}
            </button>
          </div>
        </form>

        {status !== 'idle' && (
          <div
            className={`mt-6 p-4 flex items-center gap-3 ${ status === 'success' ? 'bg-riso-spring/25 text-carbon' : 'bg-riso-redox/20 text-carbon' }`}
            role="status"
            aria-live="polite"
          >
            {status === 'success' ? (
              <CheckCircle size={20} className="text-riso-spring shrink-0" />
            ) : (
              <XCircle size={20} className="text-riso-redox shrink-0" />
            )}
            <p className="font-medium font-riso-body">{message}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-riso-blue/15 text-sm text-carbon font-riso-body">
          <p className="font-bold mb-2 font-riso-body">Not:</p>
          <ul className="list-disc list-inside space-y-1 text-carbon-soft">
            <li>Check-in yalnızca bu konum yarıçapı içinde yapılabilir.</li>
            <li>Yarıçapı kampüs/kat sınırlarına göre güncelleyin.</li>
            <li>
              Konum güncellendiğinde kullanıcılar bir sonraki girişte yeni kurala göre doğrulanır.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
