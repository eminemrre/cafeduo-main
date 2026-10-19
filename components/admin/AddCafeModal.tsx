import React from 'react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { AddCafeModalProps } from './types';
import { MapLocationPicker } from '../shared/MapLocationPicker';

export const AddCafeModal: React.FC<AddCafeModalProps> = ({
  isOpen,
  formData,
  onFormChange,
  onClose,
  onSubmit,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    eyebrow="Adını, konumunu ve check-in yarıçapını gir."
    title="Kafe Ekle"
    size="lg"
    footer={
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>
          İptal
        </Button>
        <Button variant="primary" onClick={onSubmit}>
          Kafeyi Kaydet
        </Button>
      </div>
    }
  >
    <div className="flex flex-col gap-5">
      <Input
        label="Kafe Adı"
        required
        value={formData.name}
        onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
        placeholder="örn. Kampüs Kafeterya"
      />
      <Input
        label="Adres"
        value={formData.address}
        onChange={(e) => onFormChange({ ...formData, address: e.target.value })}
        placeholder="İİBF, Merkez Kampüs"
      />
      <Input
        label="Toplam Masa Sayısı"
        type="number"
        required
        min={1}
        value={formData.total_tables}
        onChange={(e) =>
          onFormChange({
            ...formData,
            total_tables: Number.parseInt(e.target.value || '0', 10),
          })
        }
      />

      <div>
        <h3 className="mb-3 font-riso-body text-[0.9375rem] font-semibold text-carbon">
          Haritadan konum seç
        </h3>
        <MapLocationPicker
          primaryLatitude={formData.latitude}
          primaryLongitude={formData.longitude}
          primaryRadius={Number(formData.radius) || 150}
          secondaryLatitude={formData.secondaryLatitude}
          secondaryLongitude={formData.secondaryLongitude}
          secondaryRadius={Number(formData.secondaryRadius) || 150}
          onPrimaryLatitudeChange={(value) => onFormChange({ ...formData, latitude: value })}
          onPrimaryLongitudeChange={(value) => onFormChange({ ...formData, longitude: value })}
          onPrimaryCoordinatesChange={(latitude, longitude) =>
            onFormChange((current) => ({ ...current, latitude, longitude }))
          }
          onPrimaryRadiusChange={(value) =>
            onFormChange({ ...formData, radius: Number.parseInt(value || '0', 10) })
          }
          onSecondaryLatitudeChange={(value) =>
            onFormChange({ ...formData, secondaryLatitude: value })
          }
          onSecondaryLongitudeChange={(value) =>
            onFormChange({ ...formData, secondaryLongitude: value })
          }
          onSecondaryCoordinatesChange={(latitude, longitude) =>
            onFormChange((current) => ({
              ...current,
              secondaryLatitude: latitude,
              secondaryLongitude: longitude,
            }))
          }
          onSecondaryRadiusChange={(value) =>
            onFormChange({ ...formData, secondaryRadius: Number.parseInt(value || '0', 10) })
          }
        />
      </div>

      <Card variant="muted" className="p-5">
        <h3 className="mb-3 font-riso-body text-[0.9375rem] font-semibold text-carbon">
          Birincil konum
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Enlem"
            type="number"
            step="0.000001"
            value={formData.latitude}
            onChange={(e) => onFormChange({ ...formData, latitude: e.target.value })}
            placeholder="37.741000"
            className="cc-mono"
          />
          <Input
            label="Boylam"
            type="number"
            step="0.000001"
            value={formData.longitude}
            onChange={(e) => onFormChange({ ...formData, longitude: e.target.value })}
            placeholder="29.101000"
            className="cc-mono"
          />
        </div>
        <div className="mt-4">
          <Input
            label="Doğrulama Yarıçapı (metre)"
            type="number"
            required
            min={10}
            max={5000}
            value={formData.radius}
            onChange={(e) =>
              onFormChange({
                ...formData,
                radius: Number.parseInt(e.target.value || '0', 10),
              })
            }
            helper="Kullanıcılar yalnızca bu çember içinde check-in yapabilir."
          />
        </div>
      </Card>

      <Card variant="muted" className="p-5">
        <h3 className="mb-3 font-riso-body text-[0.9375rem] font-semibold text-carbon">
          İkincil konum <span className="font-normal text-carbon-soft">(isteğe bağlı)</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Ek Enlem"
            type="number"
            step="0.000001"
            value={formData.secondaryLatitude}
            onChange={(e) => onFormChange({ ...formData, secondaryLatitude: e.target.value })}
            className="cc-mono"
          />
          <Input
            label="Ek Boylam"
            type="number"
            step="0.000001"
            value={formData.secondaryLongitude}
            onChange={(e) => onFormChange({ ...formData, secondaryLongitude: e.target.value })}
            className="cc-mono"
          />
        </div>
        <div className="mt-4">
          <Input
            label="Ek Konum Yarıçapı (metre)"
            type="number"
            min={10}
            max={5000}
            value={formData.secondaryRadius}
            onChange={(e) =>
              onFormChange({
                ...formData,
                secondaryRadius: Number.parseInt(e.target.value || '0', 10),
              })
            }
          />
        </div>
      </Card>
    </div>
  </Modal>
);
