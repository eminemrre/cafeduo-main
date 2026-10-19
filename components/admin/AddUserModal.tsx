import React from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { AddUserModalProps } from './types';

const ROLE_OPTIONS = [
  { value: 'user', label: 'Kullanıcı', description: 'Standart üyelik, oyun oynar' },
  {
    value: 'cafe_admin',
    label: 'Kafe Yöneticisi',
    description: 'Bir kafenin günlük operasyonu',
  },
  { value: 'admin', label: 'Sistem Yöneticisi', description: 'Tüm panele erişim' },
];

export const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  cafes,
  isSubmitting,
  formData,
  onFormChange,
  onClose,
  onSubmit,
}) => {
  const cafeOptions = [
    { value: '', label: 'Kafe seçin', description: 'cafe_admin için zorunlu' },
    ...cafes.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="Hesap hemen açılır; şifreyi kullanıcıyla paylaş."
      title="Yeni Kullanıcı Ekle"
      size="md"
      footer={
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            İptal
          </Button>
          <Button variant="primary" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Ekleniyor…' : 'Kullanıcıyı Ekle'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Input
          label="Kullanıcı Adı"
          required
          id="new-user-username"
          value={formData.username}
          onChange={(e) => onFormChange({ ...formData, username: e.target.value })}
          placeholder="yeni_kullanici"
        />
        <Input
          label="E-posta"
          required
          type="email"
          id="new-user-email"
          value={formData.email}
          onChange={(e) => onFormChange({ ...formData, email: e.target.value })}
          placeholder="ornek@mail.com"
        />
        <Input
          label="Şifre"
          required
          type="password"
          id="new-user-password"
          value={formData.password}
          onChange={(e) => onFormChange({ ...formData, password: e.target.value })}
          helper="En az 6 karakter"
        />
        <Input
          label="Bölüm"
          value={formData.department}
          onChange={(e) => onFormChange({ ...formData, department: e.target.value })}
          placeholder="Opsiyonel — örn. İşletme"
        />
        <Select
          label="Rol"
          required
          value={formData.role}
          options={ROLE_OPTIONS}
          onChange={(next) => onFormChange({ ...formData, role: next as typeof formData.role })}
        />
        {formData.role === 'cafe_admin' && (
          <Select
            label="Atanacak Kafe"
            required
            value={formData.cafe_id}
            options={cafeOptions}
            onChange={(next) => onFormChange({ ...formData, cafe_id: next })}
          />
        )}
      </div>
    </Modal>
  );
};
