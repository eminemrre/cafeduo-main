/**
 * AvatarPickerModal — 4×4 locally served pixel-art grid.
 *
 * Surface matches the Riso Kantin redesign: paper ground, ink border, double
 * offset shadow. Each tile is a 2px-bordered square; the currently selected
 * seed gets a riso-pink double-offset ring so the user can spot their pick at
 * a glance.
 *
 * Wire-up: UserProfileModal opens this on demand. We don't need a context —
 * pass `currentSeed` (already parsed from `user.avatar_url`) and an
 * `onPick(seed)` callback that fires the PUT /users/:id request upstream.
 */
import React, { useRef } from 'react';
import { AvatarImage } from './ui/AvatarImage';
import { DialogLayer } from './ui/DialogLayer';
import { X } from 'lucide-react';
import { AVATAR_SEEDS, getAvatarUrl, type AvatarSeed } from '../lib/avatars';

interface AvatarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSeed: string | null;
  onPick: (seed: AvatarSeed) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
}

export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  onClose,
  currentSeed,
  onPick,
  saving = false,
  error,
}) => {
  const closeButton = useRef<HTMLButtonElement>(null);
  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return (
    <DialogLayer open={isOpen} onClose={onClose} label="Avatar seçimi">
      <div className="riso-kantin fixed inset-0 z-[125] flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6">
        <div className="absolute inset-0 bg-carbon/80" onClick={onClose} aria-hidden="true" />

        <div className="duo-float relative z-10 w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)] flex flex-col bg-paper">
          <div className="shrink-0 flex items-center justify-between border-b-[3px] border-dotted border-carbon/35 px-5 py-4">
            <h3 className="font-riso-display text-[1.75rem] leading-none text-carbon">Avatar seç</h3>
            <button
              ref={closeButton}
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="riso-focus inline-flex h-11 w-11 items-center justify-center bg-paper-deep text-carbon hover:bg-carbon hover:text-paper transition-colors"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {error && (
            <p
              role="alert"
              className="shrink-0 bg-riso-redox/10 px-5 py-3 text-sm text-carbon"
            >
              {error}
            </p>
          )}
          <div className="min-h-0 overflow-y-auto overscroll-contain p-5" aria-busy={saving}>
            <p
              role={saving ? 'status' : undefined}
              className="mb-3 min-h-8 text-[0.8125rem] text-carbon-soft"
            >
              {saving ? 'Avatar kaydediliyor…' : '16 avatar · Kendine birini seç'}
            </p>
            <div className="grid grid-cols-4 gap-2 sm:gap-3" data-testid="avatar-grid">
              {AVATAR_SEEDS.map((seed) => {
                const isCurrent = currentSeed === seed;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => {
                      // The options become disabled during a save. Keep keyboard
                      // focus on an enabled control in the active dialog.
                      closeButton.current?.focus();
                      void onPick(seed);
                    }}
                    disabled={saving}
                    aria-label={`Avatar: ${seed}`}
                    aria-pressed={isCurrent}
                    data-testid={`avatar-option-${seed}`}
                    className={`riso-focus relative h-16 w-full transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait ${
                      isCurrent ? 'bg-riso-pink' : 'bg-paper-deep'
                    }`}
                  >
                    <AvatarImage
                      src={getAvatarUrl(seed)}
                      initials={seed.substring(0, 2).toUpperCase()}
                      initialsClassName="font-riso-body font-semibold text-carbon"
                      imageClassName="p-1"
                      loading="eager"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DialogLayer>
  );
};
