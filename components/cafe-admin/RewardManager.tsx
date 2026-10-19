import React from 'react';
import { Coffee, Gamepad2, Gift, Plus, Trash2 } from 'lucide-react';
import type { Reward } from '../../types';
import type { RewardFormData } from './types';
import { useConfirm } from '../ui/ConfirmDialog';

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
  const { confirm, confirmDialog } = useConfirm();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateReward();
  };

  const handleDelete = async (rewardId: number | string) => {
    const ok = await confirm({
      message: 'Bu ödülü silmek istediğinize emin misiniz?',
      danger: true,
    });
    if (ok) {
      await onDeleteReward(rewardId);
    }
  };

  const inputClass =
    'duo-input riso-focus w-full px-3 text-base text-carbon placeholder:text-carbon-muted font-riso-body focus:bg-paper';

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-paper p-6 h-fit">
          <h2 className="font-riso-display text-[1.75rem] leading-none text-carbon mb-6 flex items-center gap-2">
            <Plus aria-hidden="true" />
            Yeni ödül ekle
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="reward-title-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2 font-riso-body"
              >
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
                className={inputClass}
                required
              />
            </div>
            <div>
              <label
                htmlFor="reward-cost-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2 font-riso-body"
              >
                Puan bedeli
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
                className={inputClass}
                required
              />
            </div>
            <div>
              <label
                htmlFor="reward-description-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2 font-riso-body"
              >
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
                className={`${inputClass} h-24 resize-none`}
                required
              />
            </div>
            <div>
              <label
                htmlFor="reward-icon-input"
                className="block text-[0.9375rem] font-medium text-carbon mb-2 font-riso-body"
              >
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
                className={inputClass}
              >
                <option value="coffee">Kahve</option>
                <option value="dessert">Tatlı</option>
                <option value="discount">İndirim</option>
                <option value="game">Oyun</option>
              </select>
            </div>
            <button
              type="submit"
              className="riso-focus w-full bg-riso-pink text-carbon font-riso-body font-bold py-3 transition-all"
            >
              Ödülü Oluştur
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4" aria-busy={rewardsLoading} aria-live="polite">
          <h2 className="font-riso-display text-[1.75rem] leading-none text-carbon mb-4">
            Aktif ödüller
          </h2>
          {rewardsError && (
            <div className="p-4 text-carbon bg-riso-redox/25 font-riso-body">
              {rewardsError}
            </div>
          )}
          {!rewardsError && rewards.length === 0 && !rewardsLoading ? (
            <div className="text-center py-12 text-carbon-muted bg-paper-deep">
              <Gift size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-riso-body">Henüz ödül eklenmemiş.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-paper p-4 flex justify-between items-start gap-3 group hover:-translate-y-[1px] transition-transform"
                >
                  <div className="flex gap-4 min-w-0">
                    <div className="w-12 h-12 bg-riso-spring flex items-center justify-center text-carbon shrink-0">
                      {reward.icon === 'coffee' && <Coffee size={24} />}
                      {reward.icon === 'dessert' && <Gift size={24} />}
                      {reward.icon === 'discount' && <span className="text-xl font-bold">%</span>}
                      {reward.icon === 'game' && <Gamepad2 size={22} aria-hidden="true" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-carbon font-riso-body truncate">
                        {reward.title}
                      </h3>
                      <p className="text-sm text-carbon-soft font-riso-body">
                        {reward.description}
                      </p>
                      <div className="mt-2 inline-block bg-paper-deep text-carbon text-[0.8125rem] px-2 py-0.5 font-riso-body font-semibold [font-variant-numeric:tabular-nums]">
                        {reward.cost} puan
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(reward.id)}
                    className="riso-focus text-carbon-muted hover:text-paper p-2 hover:bg-riso-redox transition-colors shrink-0"
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
      {confirmDialog}
    </>
  );
};
