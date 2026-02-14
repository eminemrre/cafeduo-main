import React from 'react';
import { CheckCircle, LocateFixed, MapPin, Navigation, Ruler, XCircle } from 'lucide-react';
import type { CafeLocationStatus } from './types';

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
      <div className="rf-panel border border-gray-800 rounded-2xl p-8 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <MapPin className="text-green-400" />
          Konum Doğrulama Ayarları
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4" aria-busy={loading}>
          <div>
            <label htmlFor="cafe-lat-input" className="block text-sm font-medium text-gray-400 mb-2">
              Enlem (Latitude)
            </label>
            <div className="relative">
              <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                id="cafe-lat-input"
                type="number"
                step="0.000001"
                value={latitude}
                onChange={(event) => onLatitudeChange(event.target.value)}
                placeholder="37.741000"
                className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-green-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cafe-lng-input" className="block text-sm font-medium text-gray-400 mb-2">
              Boylam (Longitude)
            </label>
            <div className="relative">
              <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 rotate-90" />
              <input
                id="cafe-lng-input"
                type="number"
                step="0.000001"
                value={longitude}
                onChange={(event) => onLongitudeChange(event.target.value)}
                placeholder="29.101000"
                className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-green-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cafe-radius-input" className="block text-sm font-medium text-gray-400 mb-2">
              Doğrulama Yarıçapı (metre)
            </label>
            <div className="relative">
              <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                id="cafe-radius-input"
                type="number"
                min="10"
                max="5000"
                value={radius}
                onChange={(event) => onRadiusChange(event.target.value)}
                placeholder="150"
                className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-green-500 outline-none font-mono"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-gray-700/50 space-y-4">
            <p className="text-sm font-semibold text-cyan-200">İkinci Konum (Opsiyonel)</p>
            <div>
              <label htmlFor="cafe-secondary-lat-input" className="block text-sm font-medium text-gray-400 mb-2">
                Ek Enlem (Latitude)
              </label>
              <div className="relative">
                <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="cafe-secondary-lat-input"
                  type="number"
                  step="0.000001"
                  value={secondaryLatitude}
                  onChange={(event) => onSecondaryLatitudeChange(event.target.value)}
                  placeholder="37.742000"
                  className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-cyan-400 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cafe-secondary-lng-input" className="block text-sm font-medium text-gray-400 mb-2">
                Ek Boylam (Longitude)
              </label>
              <div className="relative">
                <Navigation size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 rotate-90" />
                <input
                  id="cafe-secondary-lng-input"
                  type="number"
                  step="0.000001"
                  value={secondaryLongitude}
                  onChange={(event) => onSecondaryLongitudeChange(event.target.value)}
                  placeholder="29.102000"
                  className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-cyan-400 outline-none font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="cafe-secondary-radius-input" className="block text-sm font-medium text-gray-400 mb-2">
                Ek Konum Yarıçapı (metre)
              </label>
              <div className="relative">
                <Ruler size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="cafe-secondary-radius-input"
                  type="number"
                  min="10"
                  max="5000"
                  value={secondaryRadius}
                  onChange={(event) => onSecondaryRadiusChange(event.target.value)}
                  placeholder="150"
                  className="w-full bg-black/30 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:border-cyan-400 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => void onPickCurrentLocation()}
              className="py-3 rounded-xl border border-cyan-500/35 bg-cyan-900/20 text-cyan-100 hover:bg-cyan-900/35 font-semibold flex items-center justify-center gap-2"
            >
              <LocateFixed size={16} />
              Cihazdan Konumu Al
            </button>

            <button
              type="submit"
              disabled={loading}
              className={`py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all ${
                loading ? 'bg-gray-700 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'
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
            className={`mt-6 p-4 rounded-xl border flex items-center gap-3 ${
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

        <div className="mt-6 p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl text-sm text-blue-300">
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
