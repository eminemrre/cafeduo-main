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
      <div className="rf-panel border border-gray-800 rounded-2xl p-6 h-fit">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Plus className="text-orange-400" />
          Yeni Ödül Ekle
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reward-title-input" className="block text-sm text-gray-400 mb-1">
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
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="reward-cost-input" className="block text-sm text-gray-400 mb-1">
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
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
              required
            />
          </div>
          <div>
            <label htmlFor="reward-description-input" className="block text-sm text-gray-400 mb-1">
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
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none h-24 resize-none"
              required
            />
          </div>
          <div>
            <label htmlFor="reward-icon-input" className="block text-sm text-gray-400 mb-1">
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
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
            >
              <option value="coffee">Kahve</option>
              <option value="dessert">Tatlı</option>
              <option value="discount">İndirim</option>
              <option value="game">Oyun</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition-colors"
          >
            Ödülü Oluştur
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-4" aria-busy={rewardsLoading} aria-live="polite">
        <h2 className="text-xl font-bold text-white mb-4">Aktif Ödüller</h2>
        {rewardsError && (
          <div className="p-4 rounded-xl border border-red-600/40 text-red-300 bg-red-950/20">{rewardsError}</div>
        )}
        {!rewardsError && rewards.length === 0 && !rewardsLoading ? (
          <div className="text-center py-12 text-gray-500 rf-panel rounded-2xl border border-gray-800">
            <Gift size={48} className="mx-auto mb-4 opacity-20" />
            <p>Henüz ödül eklenmemiş.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((reward) => (
              <div
                key={reward.id}
                className="rf-panel border border-gray-700 rounded-xl p-4 flex justify-between items-start group hover:border-orange-500/50 transition-colors"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                    {reward.icon === 'coffee' && <Coffee size={24} />}
                    {reward.icon === 'dessert' && <Gift size={24} />}
                    {reward.icon === 'discount' && <span className="text-xl font-bold">%</span>}
                    {reward.icon === 'game' && <span className="text-xl">🎮</span>}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{reward.title}</h3>
                    <p className="text-sm text-gray-400">{reward.description}</p>
                    <div className="mt-2 inline-block bg-orange-900/30 text-orange-400 text-xs px-2 py-1 rounded border border-orange-900/50">
                      {reward.cost} Puan
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(reward.id)}
                  className="text-gray-600 hover:text-red-500 p-2 hover:bg-red-900/20 rounded transition-colors"
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
