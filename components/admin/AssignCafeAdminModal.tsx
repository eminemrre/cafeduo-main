import React from 'react';
import { AssignCafeAdminModalProps } from './types';

export const AssignCafeAdminModal: React.FC<AssignCafeAdminModalProps> = ({
  isOpen,
  cafes,
  selectedUser,
  selectedCafeId,
  onCafeChange,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="fixed inset-0 bg-[#02050f]/85 backdrop-blur-sm noise-bg flex items-center justify-center z-50 p-4">
      <div className="rf-screen-card p-8 max-w-md w-full relative">
        <p className="rf-terminal-strip mb-2">Yetki Atama Modülü</p>
        <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-2 glitch-text" data-text="KAFE YÖNETİCİSİ ATA">
          Kafe Yöneticisi Ata
        </h2>
        <p className="text-[var(--rf-muted)] mb-6">
          <span className="text-white font-bold">{selectedUser.username}</span> kullanıcısını hangi kafenin
          yöneticisi yapmak istiyorsunuz?
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Kafe Seç *</label>
            <select
              value={selectedCafeId}
              onChange={(e) => onCafeChange(e.target.value)}
              className="rf-input w-full p-3 text-white outline-none"
            >
              {cafes.map((cafe) => (
                <option key={String(cafe.id)} value={String(cafe.id)}>
                  {cafe.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--rf-muted)] mt-1">Seçilen kafenin yönetim yetkisi verilecek</p>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 bg-black/35 hover:bg-black/55 text-cyan-100 font-bold py-3 border-2 border-cyan-500/35 transition-colors uppercase tracking-[0.08em]"
            >
              İptal
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 border-2 border-orange-300/40 transition-colors uppercase tracking-[0.08em]"
            >
              Yönetici Yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
