/**
 * UserProfileModal — Riso Kantin redesign (PR #26).
 *
 * Player ID card modal. Surface is paper + ink border + double-offset shadow
 * (Risograph misregistration), avatar is a solid riso-blue tile (no
 * rounded-full), level progress is a flat ink track with a riso-pink fill
 * (no gradient).
 *
 */
import React, { useEffect, useRef, useState } from 'react';
import { DialogLayer } from './ui/DialogLayer';
import { X, Trophy, Gamepad2, Star, Edit2, Save, Briefcase, ImageIcon } from 'lucide-react';
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
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  isEditable = false,
  isPreview = false,
  onSaveProfile,
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
    setAvatarUrl(user?.avatar_url ?? null);
    setIsEditing(false);
    setProfileError(null);
    if (!isOpen) {
      setAvatarPickerOpen(false);
      setAvatarError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.department, isOpen]);

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
        await api.users.update({ ...user, department });
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

        <div className="relative z-10 w-full max-w-md bg-paper border-2 border-carbon riso-shadow-md overflow-hidden flex flex-col max-h-[calc(100dvh-3rem)]">
          {/* Header — ID card */}
          <div className="relative shrink-0 bg-paper border-b-2 border-carbon p-5">
            {/* Halftone overlay */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-multiply"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
                backgroundSize: '5px 5px',
              }}
            />
            <div className="relative flex items-start gap-4">
              {/* Avatar tile — DiceBear pixel-art if picked, initials fallback otherwise */}
              <div className="relative shrink-0">
                <div className="relative h-16 w-16 overflow-hidden border-2 border-carbon bg-riso-blue text-paper">
                  <AvatarImage
                    src={avatarUrl}
                    initials={(user.username || '?').substring(0, 2).toUpperCase()}
                    initialsClassName="font-riso-display text-2xl font-bold tracking-tight"
                    loading="eager"
                  />
                </div>
                {isEditable && !isPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarError(null);
                      setAvatarPickerOpen(true);
                    }}
                    aria-label="Avatar seç"
                    data-testid="open-avatar-picker"
                    className="riso-focus absolute -bottom-3.5 -right-3.5 inline-flex h-11 w-11 items-center justify-center text-carbon group"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center border-2 border-carbon bg-paper group-hover:bg-riso-pink group-hover:text-paper transition-colors">
                      <ImageIcon size={12} strokeWidth={2.5} />
                    </span>
                  </button>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="font-riso-display text-2xl text-carbon truncate">{user.username}</h2>
                <span className="block mt-0.5 font-riso-mono text-[0.7rem] uppercase tracking-[0.16em] text-carbon-muted">
                  {isPreview ? 'CafeDuo oyuncusu' : `ID: #${user.id.toString().padStart(6, '0')}`}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Profili kapat"
                className="riso-focus inline-flex h-11 w-11 items-center justify-center shrink-0 border-2 border-carbon bg-paper text-carbon hover:bg-riso-redox hover:text-paper transition-colors"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            {/* Department row */}
            {!isPreview && (
              <div className="relative mt-3">
                {isEditable && isEditing ? (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Bölüm"
                      autoFocus
                      disabled={loading}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="riso-focus min-h-11 min-w-0 flex-1 bg-paper border-2 border-carbon px-2 py-1 font-riso-body text-base text-carbon"
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
                      className="riso-focus shrink-0 inline-flex h-11 w-11 items-center justify-center border-2 border-carbon bg-paper text-riso-spring hover:bg-riso-spring hover:text-carbon transition-colors"
                    >
                      <Save size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    ref={departmentTrigger}
                    disabled={!isEditable}
                    aria-label={isEditable ? 'Bölümü düzenle' : undefined}
                    className={`inline-flex max-w-full min-w-0 items-center gap-1.5 border-2 border-carbon bg-paper-deep px-2 py-0.5 text-left ${
                      isEditable ? 'group cursor-pointer hover:bg-riso-mustard/40' : ''
                    }`}
                    onClick={() => {
                      if (!isEditable) return;
                      setDepartment(user.department || '');
                      setIsEditing(true);
                    }}
                  >
                    <Briefcase size={11} strokeWidth={2.4} className="text-carbon-muted" />
                    <span className="min-w-0 truncate font-riso-mono text-[0.7rem] uppercase tracking-wider text-carbon">
                      {user.department || 'Bölüm Girilmedi'}
                    </span>
                    {isEditable && !isPreview && (
                      <Edit2
                        size={10}
                        strokeWidth={2.5}
                        className="text-riso-pink-deep opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          {profileError && (
            <p
              role="alert"
              className="shrink-0 border-l-4 border-riso-redox bg-paper-deep px-5 py-3 text-sm text-carbon"
            >
              {profileError}
            </p>
          )}
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {isPreview ? (
              <p className="p-5 font-riso-body text-sm leading-6 text-carbon-soft">
                Bu oyuncunun ayrıntılı profili paylaşılmıyor.
              </p>
            ) : (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-3 border-b-2 border-carbon">
                  <StatCell
                    icon={<Trophy size={18} strokeWidth={2.5} />}
                    label="Galibiyet"
                    value={String(user.wins)}
                    tone="mustard"
                  />
                  <StatCell
                    icon={<Gamepad2 size={18} strokeWidth={2.5} />}
                    label="Oyun"
                    value={String(user.gamesPlayed)}
                    tone="blue"
                    borderLeft
                  />
                  <StatCell
                    icon={<Star size={18} strokeWidth={2.5} />}
                    label="Oran"
                    value={`${user.gamesPlayed > 0 ? Math.floor((user.wins / user.gamesPlayed) * 100) : 0}%`}
                    tone="pink"
                    borderLeft
                  />
                </div>

                {/* Level progress */}
                <div className="p-5 border-b-2 border-carbon bg-paper">
                  <div className="flex items-baseline justify-between font-riso-mono text-xs font-bold uppercase tracking-[0.16em] mb-2">
                    <span className="text-carbon">LEVEL {level}</span>
                    <span className="text-carbon-muted">LEVEL {level + 1}</span>
                  </div>
                  <div className="relative h-4 border-2 border-carbon bg-paper-deep overflow-hidden">
                    <div
                      className="h-full bg-riso-pink transition-[width] duration-500"
                      style={{ width: `${nextLevelProgress}%` }}
                    />
                    {/* Diagonal stripe sticker pattern over the fill */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-25"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(135deg, transparent 0 4px, var(--ink) 4px 5px)',
                        width: `${nextLevelProgress}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-right font-riso-mono text-[0.65rem] uppercase tracking-wider text-carbon-muted">
                    {user.points} CP
                  </p>
                </div>
              </>
            )}
            {isEditable && !isPreview && <ProfileActivity {...profileData} />}
          </div>
          {/* Footer strip */}
          <div className="shrink-0 border-t-2 border-carbon bg-riso-mustard px-4 py-2 text-center">
            <span className="font-riso-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-carbon">
              {isPreview ? 'CafeDuo · Oyuncu' : 'CafeDuo Üye Kartı · Güncel'}
            </span>
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
              // Optimistic update so the picker closes feeling instant.
              setAvatarUrl(nextUrl);
              await api.users.update({ ...user, avatar_url: nextUrl });
              setAvatarPickerOpen(false);
            } catch {
              setAvatarError('Avatar kaydedilemedi. Tekrar deneyebilirsin.');
              // Roll back on failure and surface a generic warning — the
              // backend rejects malformed URLs, so this is rare in normal flow.
              setAvatarUrl(user.avatar_url ?? null);
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
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'mustard' | 'blue' | 'pink';
  borderLeft?: boolean;
}

const TONE_BG: Record<StatCellProps['tone'], string> = {
  mustard: 'bg-riso-mustard text-carbon',
  blue: 'bg-riso-blue text-paper',
  pink: 'bg-riso-pink text-carbon',
};

const StatCell: React.FC<StatCellProps> = ({ icon, label, value, tone, borderLeft }) => (
  <div className={`p-4 text-center bg-paper ${borderLeft ? 'border-l-2 border-carbon' : ''}`}>
    <div
      className={`inline-flex h-9 w-9 items-center justify-center border-2 border-carbon mb-1.5 ${TONE_BG[tone]}`}
    >
      {icon}
    </div>
    <span className="block font-riso-display text-2xl text-carbon">{value}</span>
    <span className="block font-riso-mono text-[0.6rem] uppercase tracking-[0.16em] text-carbon-muted">
      {label}
    </span>
  </div>
);
