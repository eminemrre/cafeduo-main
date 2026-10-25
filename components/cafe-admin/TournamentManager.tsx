/**
 * TournamentManager — cafe-admin tab for creating + cancelling tournaments.
 *
 * Layout mirrors RewardManager: a creation form on top, a list of existing
 * tournaments below (with status badge + cancel button on scheduled rows).
 *
 * Prize-tier builder is a vertically-stacked add/remove list where each row
 * is a rank (auto-numbered) + reward dropdown sourced from the cafe's
 * current rewards (passed in via props so we share useCafeAdmin's fetch).
 */
import React, { useMemo, useState } from 'react';
import { Trophy, Plus, X, Calendar, Trash2 } from 'lucide-react';
import type { Reward, Tournament } from '../../types';
import type { TournamentFormData, TournamentTierForm } from './types';

// Game types shipped today. The backend accepts exactly shared/gameRegistry.js
// (CommonJS, so not imported here); TournamentManager.test.tsx keeps the two equal.
export const GAME_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Tüm oyunlar' },
  { value: 'Nişancı Düellosu', label: 'Nişancı Düellosu' },
  { value: 'Bilgi Yarışı', label: 'Bilgi Yarışı' },
  { value: 'Retro Satranç', label: 'Retro Satranç' },
  { value: 'Amiral Battı', label: 'Amiral Battı' },
  { value: 'Adam Asmaca', label: 'Adam Asmaca' },
  { value: 'Çiz Bil', label: 'Çiz Bil' },
];

interface TournamentManagerProps {
  rewards: Reward[];
  rewardsLoading: boolean;
  tournaments: Tournament[];
  tournamentsLoading: boolean;
  tournamentsError: string | null;
  tournamentForm: TournamentFormData;
  setTournamentForm: (form: TournamentFormData) => void;
  onCreate: () => Promise<void>;
  onCancel: (id: number | string) => Promise<void>;
}

const STATUS_LABEL: Record<Tournament['status'], { label: string; klass: string }> = {
  scheduled: { label: 'Planlandı', klass: 'bg-candy-limon text-carbon' },
  active: { label: 'Canlı', klass: 'bg-candy-fistik text-carbon' },
  finalizing: { label: 'Sonuçlanıyor', klass: 'bg-candy-gok text-paper' },
  finished: { label: 'Tamamlandı', klass: 'bg-paper-deep text-carbon-muted' },
  cancelled: { label: 'İptal', klass: 'bg-candy-danger/30 text-carbon' },
};

const formatLocal = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const TournamentManager: React.FC<TournamentManagerProps> = ({
  rewards,
  rewardsLoading,
  tournaments,
  tournamentsLoading,
  tournamentsError,
  tournamentForm,
  setTournamentForm,
  onCreate,
  onCancel,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const activeRewards = useMemo(() => rewards.filter((r) => r.is_active !== false), [rewards]);

  const updateTier = (idx: number, patch: Partial<TournamentTierForm>) => {
    const next = tournamentForm.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t));
    setTournamentForm({ ...tournamentForm, tiers: next });
  };

  const addTier = () => {
    if (tournamentForm.tiers.length >= 10) return;
    setTournamentForm({
      ...tournamentForm,
      tiers: [...tournamentForm.tiers, { rank: tournamentForm.tiers.length + 1, rewardId: null }],
    });
  };

  const removeTier = (idx: number) => {
    if (tournamentForm.tiers.length <= 1) return;
    const next = tournamentForm.tiers
      .filter((_, i) => i !== idx)
      .map((t, i) => ({ ...t, rank: i + 1 }));
    setTournamentForm({ ...tournamentForm, tiers: next });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await onCreate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Turnuva oluşturulamadı.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8" data-testid="tournament-manager">
      {/* Create form */}
      <section className="bg-paper p-5">
        <div className="flex items-center gap-3 mb-4 border-b-[3px] border-dotted border-carbon/35 pb-3">
          <Trophy size={22} className="text-carbon" aria-hidden="true" />
          <h3 className="font-candy-display text-[1.75rem] leading-none text-carbon">
            Yeni turnuva
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-2 font-candy-body text-[0.9375rem] font-medium text-carbon">
              Ad
            </label>
            <input
              type="text"
              value={tournamentForm.name}
              onChange={(e) => setTournamentForm({ ...tournamentForm, name: e.target.value })}
              maxLength={120}
              required
              placeholder="Örn. Çarşamba Akşam Turnuvası"
              data-testid="tournament-name-input"
              className="duo-input duo-focus w-full px-3 font-candy-body text-base text-carbon focus:bg-paper"
            />
          </div>

          <div>
            <label className="block mb-2 font-candy-body text-[0.9375rem] font-medium text-carbon">
              Oyun türü
            </label>
            <select
              value={tournamentForm.gameType}
              onChange={(e) => setTournamentForm({ ...tournamentForm, gameType: e.target.value })}
              data-testid="tournament-gametype-select"
              className="duo-input duo-focus w-full px-3 font-candy-body text-base text-carbon focus:bg-paper"
            >
              {GAME_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 font-candy-body text-[0.9375rem] font-medium text-carbon">
                Başlangıç
              </label>
              <input
                type="datetime-local"
                value={tournamentForm.startAt}
                onChange={(e) => setTournamentForm({ ...tournamentForm, startAt: e.target.value })}
                required
                data-testid="tournament-start-input"
                className="duo-input duo-focus w-full px-3 font-candy-body text-base text-carbon focus:bg-paper"
              />
            </div>
            <div>
              <label className="block mb-2 font-candy-body text-[0.9375rem] font-medium text-carbon">
                Bitiş
              </label>
              <input
                type="datetime-local"
                value={tournamentForm.endAt}
                onChange={(e) => setTournamentForm({ ...tournamentForm, endAt: e.target.value })}
                required
                data-testid="tournament-end-input"
                className="duo-input duo-focus w-full px-3 font-candy-body text-base text-carbon focus:bg-paper"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-candy-body text-[0.9375rem] font-medium text-carbon">
                Ödül Sıralaması
              </label>
              <button
                type="button"
                onClick={addTier}
                disabled={tournamentForm.tiers.length >= 10}
                data-testid="tournament-add-tier"
                className="duo-focus inline-flex items-center gap-1 bg-paper-deep px-2 py-1 font-candy-body text-xs text-carbon hover:bg-paper-dim transition-colors disabled:opacity-50"
              >
                <Plus size={12} /> Kademe ekle
              </button>
            </div>

            <div className="space-y-2">
              {tournamentForm.tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 bg-paper-deep px-3 py-2"
                >
                  <span className="font-candy-body text-base font-bold text-candy-lokum-deep min-w-[2rem]">
                    #{idx + 1}
                  </span>
                  <select
                    value={tier.rewardId ?? ''}
                    onChange={(e) =>
                      updateTier(idx, {
                        rewardId: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    required
                    data-testid={`tournament-tier-${idx}-reward`}
                    className="duo-input duo-input--sm duo-focus flex-1 min-w-[140px] px-2 font-candy-body text-base text-carbon"
                  >
                    <option value="">Ödül seç...</option>
                    {activeRewards.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.cost} puan)
                      </option>
                    ))}
                  </select>
                  {tournamentForm.tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      aria-label="Kademeyi sil"
                      data-testid={`tournament-tier-${idx}-remove`}
                      className="duo-focus inline-flex h-7 w-7 items-center justify-center bg-paper text-carbon hover:bg-candy-danger/30 transition-colors"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {rewardsLoading && (
              <p className="mt-2 font-candy-body text-xs text-carbon-muted">
                Ödüller yükleniyor...
              </p>
            )}
            {!rewardsLoading && activeRewards.length === 0 && (
              <p className="mt-2 font-candy-body text-xs text-candy-danger">
                Bu kafede aktif ödül yok. Önce 'Ödül Yönetimi' sekmesinden ödül ekle.
              </p>
            )}
          </div>

          {formError && (
            <p
              className="font-candy-body text-sm text-candy-danger"
              data-testid="tournament-form-error"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || activeRewards.length === 0}
            data-testid="tournament-submit"
            className="duo-focus inline-flex items-center gap-2 bg-candy-lokum px-5 py-2.5 font-candy-body text-sm font-bold text-carbon hover:bg-candy-lokum-deep transition-colors disabled:opacity-50"
          >
            <Trophy size={16} strokeWidth={2.5} />
            {submitting ? 'Oluşturuluyor...' : 'Turnuvayı Oluştur'}
          </button>
        </form>
      </section>

      {/* List of existing */}
      <section className="bg-paper p-5">
        <div className="flex items-center gap-3 mb-4 border-b-[3px] border-dotted border-carbon/35 pb-3">
          <Calendar size={20} className="text-carbon" />
          <h3 className="font-candy-display text-[1.75rem] leading-none text-carbon">
            Mevcut turnuvalar
          </h3>
        </div>

        {tournamentsLoading ? (
          <p className="font-candy-body text-carbon-muted animate-pulse">Yükleniyor...</p>
        ) : tournamentsError ? (
          <p className="font-candy-body text-candy-danger">{tournamentsError}</p>
        ) : tournaments.length === 0 ? (
          <p className="font-candy-body text-carbon-muted">Henüz turnuva yok.</p>
        ) : (
          <ul className="space-y-3" data-testid="tournament-list">
            {tournaments.map((t) => {
              const status = STATUS_LABEL[t.status] ?? STATUS_LABEL.scheduled;
              return (
                <li
                  key={t.id}
                  className="bg-paper-deep p-3 sm:p-4"
                  data-testid={`tournament-row-${t.id}`}
                >
                  <div className="flex items-start gap-3 justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`inline-flex items-center font-candy-body text-xs px-2 py-0.5 ${status.klass}`}
                        >
                          {status.label}
                        </span>
                        {t.game_type && (
                          <span className="font-candy-body text-xs text-carbon-muted">
                            {t.game_type}
                          </span>
                        )}
                      </div>
                      <h4 className="font-candy-body text-base text-carbon truncate">{t.name}</h4>
                      <p className="font-candy-body text-xs text-carbon-muted">
                        {formatLocal(t.start_at)} → {formatLocal(t.end_at)}
                      </p>
                      <p className="mt-1 font-candy-body text-xs text-carbon-muted">
                        {t.prize_tiers.length} ödül kademesi
                      </p>
                    </div>
                    {t.status === 'scheduled' && (
                      <button
                        type="button"
                        onClick={() => void onCancel(t.id)}
                        aria-label="İptal et"
                        data-testid={`tournament-cancel-${t.id}`}
                        className="duo-focus inline-flex h-8 w-8 items-center justify-center bg-paper text-carbon hover:bg-candy-danger/30 transition-colors"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};
