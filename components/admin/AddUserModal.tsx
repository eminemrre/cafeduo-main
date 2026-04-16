import React from 'react';
import { AddUserModalProps } from './types';

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  cafes,
  isSubmitting,
  formData,
  onFormChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#02050f]/85 backdrop-blur-sm noise-bg flex items-center justify-center z-50 p-4">
      <div className="rf-screen-card p-8 max-w-md w-full relative">
        <p className="rf-terminal-strip mb-2">Kullanıcı Kayıt Arayüzü</p>
        <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-6 glitch-text" data-text="YENİ KULLANICI EKLE">
          Yeni Kullanıcı Ekle
        </h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="new-user-username" className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">
              Kullanıcı Adı *
            </label>
            <input
              id="new-user-username"
              type="text"
              value={formData.username}
              onChange={(e) => onFormChange({ ...formData, username: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="Örn: yeni_kullanici"
            />
          </div>

          <div>
            <label htmlFor="new-user-email" className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">
              E-posta *
            </label>
            <input
              id="new-user-email"
              type="email"
              value={formData.email}
              onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="ornek@mail.com"
            />
          </div>

          <div>
            <label htmlFor="new-user-password" className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">
              Şifre *
            </label>
            <input
              id="new-user-password"
              type="password"
              value={formData.password}
              onChange={(e) => onFormChange({ ...formData, password: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="En az 6 karakter"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Bölüm</label>
            <input
              type="text"
              value={formData.department}
              onChange={(e) => onFormChange({ ...formData, department: e.target.value })}
              className="rf-input w-full p-3 text-white outline-none"
              placeholder="Opsiyonel"
            />
          </div>

          <div>
            <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Rol</label>
            <select
              value={formData.role}
              onChange={(e) =>
                onFormChange({
                  ...formData,
                  role: e.target.value as typeof formData.role,
                })
              }
              className="rf-input w-full p-3 text-white outline-none"
            >
              <option value="user">Kullanıcı</option>
              <option value="cafe_admin">Kafe Yöneticisi</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {formData.role === 'cafe_admin' && (
            <div>
              <label className="block text-[var(--rf-muted)] text-xs uppercase tracking-[0.12em] mb-2">Kafe *</label>
              <select
                value={formData.cafe_id}
                onChange={(e) => onFormChange({ ...formData, cafe_id: e.target.value })}
                className="rf-input w-full p-3 text-white outline-none"
              >
                <option value="">Kafe seçin</option>
                {cafes.map((cafe) => (
                  <option key={String(cafe.id)} value={String(cafe.id)}>
                    {cafe.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 bg-black/35 hover:bg-black/55 text-cyan-100 font-bold py-3 border-2 border-cyan-500/35 transition-colors uppercase tracking-[0.08em]"
            >
              İptal
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-[#041226] font-bold py-3 border-2 border-cyan-200 transition-colors uppercase tracking-[0.08em] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Ekleniyor...' : 'Kullanıcı Ekle'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
