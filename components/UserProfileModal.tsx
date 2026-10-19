/**
 * UserProfileModal — the player's member card in the v2 Masa register:
 * paper floating on the scrim with the one soft shadow, numbers in ice
 * wells, level progress as a flat fıstık meter (points are fıstık).
 */
import React, { useEffect, useRef, useState } from 'react';
import { DialogLayer } from './ui/DialogLayer';
import { X, Edit2, Save, Briefcase, ImageIcon } from 'lucide-react';
import { User } from '../types';
import { api } from '../lib/api';
import { PAU_DEPARTMENTS } from '../constants';
import { AvatarImage } from './ui/AvatarImage';
import { getAvatarUrl, seedFromAvatarUrl, type AvatarSeed } from '../lib/avatars';
import { AvatarPickerModal } from './AvatarPickerModal';
import { useToast } from '../contexts/ToastContext';
import { useProfileData } from '../hooks/useProfileData';
import { ProfileActivity } from './profile/ProfileActivity';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  isEditable?: boolean;
  isPreview?: boolean;
  onSaveProfile?: (department: string) => Promise<void> | void;
  onSaveAvatar?: (avatarUrl: string) => Promise<void> | void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  isEditable = false,
  isPreview = false,
  onSaveProfile,
  onSaveAvatar,
}) => {
  const toast = useToast();
  const departmentTrigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [department, setDepartment] = useState(user?.department || '');
  const [loading, setLoading] = useState(false);
  const profileData = useProfileData(
    user?.id,
    user?.username || '',
    isOpen && isEditable && !isPreview
  );
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);

  useEffect(() => {
    setDepartment(user?.department || '');
    setIsEditing(false);
    setProfileError(null);
    if (!isOpen) {
      setAvatarPickerOpen(false);
      setAvatarError(null);
    }
  }, [user?.id, user?.department, isOpen]);

  useEffect(() => {
    setAvatarUrl(user?.avatar_url ?? null);
  }, [user?.id, user?.avatar_url, isOpen]);

  useEffect(() => {
    if (isOpen && wasEditing.current && !isEditing) departmentTrigger.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing, isOpen]);

  if (!isOpen || !user) return null;

  // Simple level math (1 level per 500 points)
  const level = Math.floor(user.points / 500) + 1;
  const nextLevelProgress = ((user.points % 500) / 500) * 100;

  const handleSave = async () => {
    setLoading(true);
    setProfileError(null);
    try {
      if (onSaveProfile) {
        await onSaveProfile(department);
      } else {
        await api.users.updateProfile(user.id, { department });
      }
      setIsEditing(false);
    } catch {
      setProfileError('Bölüm güncellenemedi. Tekrar deneyebilirsin.');
      toast.error('Güncelleme başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogLayer open={isOpen} onClose={onClose} label={`${user.username} profili`}>
      <div className="riso-kantin fixed inset-0 z-[115] flex items-center justify-center px-4 py-6">
        {/* The visual scrim stays inside the native modal layer. */}
        <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />

        <div className="duo-float relative z-10 w-full max-w-md bg-paper overflow-hidden flex flex-col max-h-[calc(100dvh-3rem)]">
          {/* Header: the member's name, id and department */}
          <div className="shrink-0 bg-paper px-5 pt-5 pb-4">
            <div className="flex items-start gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-riso-blue text-carbon">
                <AvatarImage
                  src={avatarUrl}
                  initials={(user.username || '?').substring(0, 2).toUpperCase()}
                  initialsClassName="font-riso-display text-[28px] leading-none"
                  loading="eager"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-riso-display text-[28px] leading-none text-carbon truncate">
                  {user.username}
                </h2>
                <span className="mt-1.5 block text-[13px] text-carbon-muted [font-variant-numeric:tabular-nums]">
                  {isPreview ? 'CafeDuo oyuncusu' : `ID: #${user.id.toString().padStart(6, '0')}`}
                </span>
                {isEditable && !isPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarError(null);
                      setAvatarPickerOpen(true);
                    }}
                    data-testid="open-avatar-picker"
                    className="duo-quiet riso-focus -ml-1 mt-1 min-h-11 gap-2 px-1"
                  >
                    <ImageIcon size={16} strokeWidth={2.2} aria-hidden="true" />
                    Avatar seç
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Profili kapat"
                className="riso-focus inline-flex h-11 w-11 items-center justify-center shrink-0 bg-paper-deep text-carbon hover:bg-carbon hover:text-paper transition-colors"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </div>

            {!isPreview && (
              <div className="mt-3">
                {isEditable && isEditing ? (
                  <div className="flex w-full items-center gap-2">
                    <select
                      aria-label="Bölüm"
                      autoFocus
                      disabled={loading}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="duo-input riso-focus min-h-11 min-w-0 flex-1 px-3 font-riso-body text-base text-carbon"
                    >
                      <option value="">Bölüm Seçiniz</option>
                      {PAU_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={loading}
                      aria-label="Bölümü kaydet"
                      className="riso-focus shrink-0 inline-flex h-11 w-11 items-center justify-center bg-carbon text-paper hover:bg-carbon-soft disabled:opacity-50 transition-colors"
                    >
                      <Save size={16} strokeWidth={2.4} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    ref={departmentTrigger}
                    disabled={!isEditable}
                    aria-label={isEditable ? 'Bölümü düzenle' : undefined}
                    className={`inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 bg-paper-deep px-3 text-left text-sm text-carbon ${
                      isEditable ? 'riso-focus cursor-pointer hover:bg-paper-dim transition-colors' : ''
                    }`}
                    onClick={() => {
                      if (!isEditable) return;
                      setDepartment(user.department || '');
                      setIsEditing(true);
                    }}
                  >
                    <Briefcase size={14} strokeWidth={2.2} className="shrink-0 text-carbon-muted" />
                    <span className="min-w-0 truncate">{user.department || 'Bölüm Girilmedi'}</span>
                    {isEditable && !isPreview && (
                      <Edit2 size={13} strokeWidth={2.4} className="shrink-0 text-carbon-muted" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {profileError && (
            <p role="alert" className="shrink-0 bg-riso-redox/10 px-5 py-3 text-sm text-carbon">
              {profileError}
            </p>
          )}
          <div className="min-h-0 overflow-y-auto overscroll-contain border-t-[3px] border-dotted border-carbon/35">
            {isPreview ? (
              <p className="p-5 font-riso-body text-sm leading-6 text-carbon-soft">
                Bu oyuncunun ayrıntılı profili paylaşılmıyor.
              </p>
            ) : (
              <div className="px-5 pt-5">
                <div className="grid grid-cols-3 gap-2">
                  <StatCell label="Galibiyet" value={String(user.wins)} />
                  <StatCell label="Oyun" value={String(user.gamesPlayed)} />
                  <StatCell
                    label="Oran"
                    value={`${user.gamesPlayed > 0 ? Math.floor((user.wins / user.gamesPlayed) * 100) : 0}%`}
                  />
                </div>

                {/* Level progress: points are fıstık */}
                <div className="mt-5">
                  <div className="flex items-baseline justify-between text-sm font-semibold">
                    <span className="text-carbon">Seviye {level}</span>
                    <span className="text-carbon-muted">Seviye {level + 1}</span>
                  </div>
                  <div
                    className="duo-meter mt-2"
                    role="progressbar"
                    aria-label="Sonraki seviyeye ilerleme"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(nextLevelProgress)}
                  >
                    <span
                      className="bg-riso-spring transition-[width] duration-500"
                      style={{ width: `${nextLevelProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[13px] text-carbon-muted [font-variant-numeric:tabular-nums]">
                    {user.points} puan · sonraki seviyeye {500 - (user.points % 500)} puan
                  </p>
                </div>
              </div>
            )}
            {isEditable && !isPreview && <ProfileActivity {...profileData} />}
            <div className="h-5" aria-hidden="true" />
          </div>
        </div>
        <AvatarPickerModal
          isOpen={avatarPickerOpen && isEditable && !isPreview}
          onClose={() => setAvatarPickerOpen(false)}
          currentSeed={seedFromAvatarUrl(avatarUrl)}
          saving={savingAvatar}
          error={avatarError}
          onPick={async (seed: AvatarSeed) => {
            const nextUrl = getAvatarUrl(seed);
            setSavingAvatar(true);
            setAvatarError(null);
            try {
              if (onSaveAvatar) {
                await onSaveAvatar(nextUrl);
              } else {
                await api.users.updateProfile(user.id, { avatar_url: nextUrl });
              }
              setAvatarUrl(nextUrl);
              setAvatarPickerOpen(false);
            } catch {
              setAvatarError('Avatar kaydedilemedi. Tekrar deneyebilirsin.');
              toast.error('Avatar kaydedilemedi.');
            } finally {
              setSavingAvatar(false);
            }
          }}
        />
      </div>
    </DialogLayer>
  );
};

interface StatCellProps {
  label: string;
  value: string;
}

const StatCell: React.FC<StatCellProps> = ({ label, value }) => (
  <div className="duo-stat">
    <span className="duo-stat-label text-[13px]">{label}</span>
    <span className="duo-stat-value text-[28px] leading-none mt-1.5">{value}</span>
  </div>
);
