import React from 'react';
import { AddCafeModalProps } from './types';

export const AddCafeModal: React.FC<AddCafeModalProps> = ({
  isOpen,
  formData,
  onFormChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[linear-gradient(170deg,rgba(8,14,30,0.96),rgba(10,24,52,0.88))] border border-cyan-400/25 rounded-2xl p-8 max-w-md w-full relative">
        <h2 className="text-2xl font-bold text-white mb-6">Yeni Kafe Ekle</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-sm mb-2">Kafe Adı *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              placeholder="Örn: Kampüs Kafeterya"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Adres</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => onFormChange({ ...formData, address: e.target.value })}
              className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              placeholder="Örn: İİBF, Merkez Kampüs"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Toplam Masa Sayısı *</label>
            <input
              type="number"
              value={formData.total_tables}
              onChange={(e) =>
                onFormChange({
                  ...formData,
                  total_tables: Number.parseInt(e.target.value || '0', 10),
                })
              }
              className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Enlem (Latitude) *</label>
            <input
              type="number"
              step="0.000001"
              value={formData.latitude}
              onChange={(e) => onFormChange({ ...formData, latitude: e.target.value })}
              className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500 font-mono text-lg"
              placeholder="37.741000"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Boylam (Longitude) *</label>
            <input
              type="number"
              step="0.000001"
              value={formData.longitude}
              onChange={(e) => onFormChange({ ...formData, longitude: e.target.value })}
              className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500 font-mono text-lg"
              placeholder="29.101000"
            />
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-2">Doğrulama Yarıçapı (metre) *</label>
            <input
              type="number"
              min="10"
              max="5000"
              value={formData.radius}
              onChange={(e) =>
                onFormChange({
                  ...formData,
                  radius: Number.parseInt(e.target.value || '0', 10),
                })
              }
              className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-blue-500"
              placeholder="150"
            />
          </div>

          <div className="pt-2 border-t border-gray-700/60">
            <p className="text-sm text-cyan-200 font-semibold mb-3">İkinci Konum (Opsiyonel)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Ek Enlem</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.secondaryLatitude}
                  onChange={(e) => onFormChange({ ...formData, secondaryLatitude: e.target.value })}
                  className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-cyan-500 font-mono"
                  placeholder="37.742000"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Ek Boylam</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.secondaryLongitude}
                  onChange={(e) => onFormChange({ ...formData, secondaryLongitude: e.target.value })}
                  className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-cyan-500 font-mono"
                  placeholder="29.102000"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Ek Konum Yarıçapı (metre)</label>
                <input
                  type="number"
                  min="10"
                  max="5000"
                  value={formData.secondaryRadius}
                  onChange={(e) =>
                    onFormChange({
                      ...formData,
                      secondaryRadius: Number.parseInt(e.target.value || '0', 10),
                    })
                  }
                  className="w-full bg-black/40 border border-gray-600 rounded-lg p-3 text-white outline-none focus:border-cyan-500"
                  placeholder="150"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-colors"
            >
              İptal
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
