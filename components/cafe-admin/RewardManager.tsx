import React from 'react';
import { Coffee, Gift, Plus, Trash2 } from 'lucide-react';
import type { Reward } from '../../types';
import type { RewardFormData } from './types';

interface RewardManagerProps {
  rewards: Reward[];
  rewardsLoading: boolean;
  rewardsError: string | null;
  rewardForm: RewardFormData;
  onRewardFormChange: (next: RewardFormData) => void;
  onCreateReward: () => Promise<void>;
  onDeleteReward: (rewardId: number | string) => Promise<void>;
}

export const RewardManager: React.FC<RewardManagerProps> = ({
  rewards,
  rewardsLoading,
  rewardsError,
  rewardForm,
  onRewardFormChange,
  onCreateReward,
  onDeleteReward,
}) => {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateReward();
  };

  const handleDelete = async (rewardId: number | string) => {
    if (window.confirm('Bu ödülü silmek istediğinize emin misiniz?')) {
      await onDeleteReward(rewardId);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="rf-screen-card p-6 h-fit">
        <p className="rf-terminal-strip mb-2">Ödül Entegrasyon</p>
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Plus className="text-orange-400" />
          Yeni Ödül Ekle
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reward-title-input" className="block text-sm text-[var(--rf-muted)] mb-1 uppercase tracking-[0.08em]">
              Ödül Başlığı
            </label>
            <input
              id="reward-title-input"
              type="text"
              value={rewardForm.title}
              onChange={(event) =>
                onRewardFormChange({
                  ...rewardForm,
                  title: event.target.value,
                })
              }
              className="rf-input w-full p-3 text-white outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="reward-cost-input" className="block text-sm text-[var(--rf-muted)] mb-1 uppercase tracking-[0.08em]">
              Puan Bedeli
            </label>
            <input
              id="reward-cost-input"
              type="number"
              value={rewardForm.cost}
              onChange={(event) =>
                onRewardFormChange({
                  ...rewardForm,
                  cost: Math.max(0, Number(event.target.value || 0)),
                })
              }
              className="rf-input w-full p-3 text-white outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="reward-description-input" className="block text-sm text-[var(--rf-muted)] mb-1 uppercase tracking-[0.08em]">
              Açıklama
            </label>
            <textarea
              id="reward-description-input"
              value={rewardForm.description}
              onChange={(event) =>
                onRewardFormChange({
                  ...rewardForm,
                  description: event.target.value,
                })
              }
              className="rf-input w-full p-3 text-white outline-none h-24 resize-none"
              required
            />
          </div>
          <div>
            <label htmlFor="reward-icon-input" className="block text-sm text-[var(--rf-muted)] mb-1 uppercase tracking-[0.08em]">
              İkon Tipi
            </label>
            <select
              id="reward-icon-input"
              value={rewardForm.icon}
              onChange={(event) =>
                onRewardFormChange({
                  ...rewardForm,
                  icon: event.target.value as RewardFormData['icon'],
                })
              }
              className="rf-input w-full p-3 text-white outline-none"
            >
              <option value="coffee">Kahve</option>
              <option value="dessert">Tatlı</option>
              <option value="discount">İndirim</option>
              <option value="game">Oyun</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 border-2 border-orange-300/40 transition-colors uppercase tracking-[0.08em]"
          >
            Ödülü Oluştur
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-4" aria-busy={rewardsLoading} aria-live="polite">
        <h2 className="text-xl font-bold text-white mb-4">Aktif Ödüller</h2>
        {rewardsError && (
          <div className="p-4 border border-red-600/40 text-red-300 bg-red-950/20">{rewardsError}</div>
        )}
        {!rewardsError && rewards.length === 0 && !rewardsLoading ? (
          <div className="text-center py-12 text-[var(--rf-muted)] rf-screen-card-muted">
            <Gift size={48} className="mx-auto mb-4 opacity-20" />
            <p>Henüz ödül eklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="rf-screen-card-muted p-4 flex justify-between items-start group hover:border-orange-500/50 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-[#07142b] border border-cyan-800/40 flex items-center justify-center text-[var(--rf-muted)]">
                    {reward.icon === 'coffee' && <Coffee size={24} />}
                    {reward.icon === 'dessert' && <Gift size={24} />}
                    {reward.icon === 'discount' && <span className="text-xl font-bold">%</span>}
                    {reward.icon === 'game' && <span className="text-xl">🎮</span>}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{reward.title}</h3>
                    <p className="text-sm text-[var(--rf-muted)]">{reward.description}</p>
                    <div className="mt-2 inline-block bg-orange-900/30 text-orange-400 text-xs px-2 py-1 border border-orange-900/50">
                      {reward.cost} Puan
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(reward.id)}
                  className="text-[var(--rf-muted)] hover:text-red-500 p-2 hover:bg-red-900/20 transition-colors border border-transparent hover:border-red-500/30"
                  aria-label={`${reward.title} ödülünü sil`}
                  title="Ödülü sil"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
