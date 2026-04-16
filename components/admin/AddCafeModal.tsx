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
    <div className="fixed inset-0 bg-[#02050f]/85 backdrop-blur-sm noise-bg flex items-center justify-center z-50 p-4">
      <div className="rf-screen-card max-w-md w-full relative overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="px-8 pt-8 pb-4 border-b border-cyan-400/20">
          <p className="rf-terminal-strip mb-2">Kafe Ekleme Protokolü</p>
          <h2 className="text-2xl font-display text-white tracking-[0.08em] glitch-text" data-text="YENİ KAFE EKLE">
            Yeni Kafe Ekle
          </h2>
        </div>

        <div className="space-y-4 overflow-y-auto rf-modal-scroll px-8 py-5 min-h-0">
          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Kafe Adı *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="Örn: Kampüs Kafeterya"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Adres</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => onFormChange({ ...formData, address: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="Örn: İİBF, Merkez Kampüs"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Toplam Masa Sayısı *</label>
            <input
              type="number"
              value={formData.total_tables}
              onChange={(e) =>
                onFormChange({
                  ...formData,
                  total_tables: Number.parseInt(e.target.value || '0', 10),
                })
              }
              className="rf-input w-full p-3 text-white outline-none"
              min="1"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Enlem (Latitude) *</label>
            <input
              type="number"
              step="0.000001"
              value={formData.latitude}
              onChange={(e) => onFormChange({ ...formData, latitude: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none font-mono text-lg"
              placeholder="37.741000"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Boylam (Longitude) *</label>
            <input
              type="number"
              step="0.000001"
              value={formData.longitude}
              onChange={(e) => onFormChange({ ...formData, longitude: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none font-mono text-lg"
              placeholder="29.101000"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Doğrulama Yarıçapı (metre) *</label>
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
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="150"
            />
          </div>

          <div className="pt-2 border-t border-cyan-500/20">
            <p className="text-sm text-cyan-200 font-semibold mb-3">İkinci Konum (Opsiyonel)</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Ek Enlem</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.secondaryLatitude}
                  onChange={(e) => onFormChange({ ...formData, secondaryLatitude: e.target.value })}
                  className="rf-input w-full p-3 text-white outline-none font-mono"
                  placeholder="37.742000"
                />
              </div>
              <div>
                <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Ek Boylam</label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.secondaryLongitude}
                  onChange={(e) => onFormChange({ ...formData, secondaryLongitude: e.target.value })}
                  className="rf-input w-full p-3 text-white outline-none font-mono"
                  placeholder="29.102000"
                />
              </div>
              <div>
                <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Ek Konum Yarıçapı (metre)</label>
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
                  className="rf-input w-full p-3 text-white outline-none"
                  placeholder="150"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8 sticky bottom-0 pt-4 bg-[linear-gradient(180deg,rgba(2,7,19,0),rgba(2,7,19,0.96)_24%,rgba(2,7,19,0.99))]">
            <button
              onClick={onClose}
              className="flex-1 bg-black/35 hover:bg-black/55 text-cyan-100 font-bold py-3 border-2 border-cyan-500/35 transition-colors uppercase tracking-[0.08em]"
            >
              İptal
            </button>
            <button
              onClick={onSubmit}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 border-2 border-green-300/40 transition-colors uppercase tracking-[0.08em]"
            >
              Ekle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
