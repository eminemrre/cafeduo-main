/**
 * RewardSection — the café's menu and the player's coupons (DESIGN.md v2).
 *
 * The shop reads like the landing's menu: one row per reward with a 4 px
 * dotted leader to the price. Coupons are paper tickets with a fıstık edge
 * and a QR. All data-testid attributes are preserved (`shop-tab`,
 * `inventory-tab`, `shop-buy-button`, plus `skeleton-grid`, `empty-state`,
 * `empty-state-action` from the mocked subcomponents).
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  Coffee,
  Percent,
  Cookie,
  Gamepad2,
  ShoppingBag,
  Package,
  Gift,
  ArrowRight,
} from 'lucide-react';
import { Reward, RedeemedReward, User } from '../../types';
import { Button } from '../ui';
import { SkeletonGrid } from '../Skeleton';
import { EmptyState } from '../EmptyState';
import { CouponDetailModal } from './CouponDetailModal';

interface RewardSectionProps {
  currentUser: User;
  rewards: Reward[];
  rewardsLoading: boolean;
  inventory: RedeemedReward[];
  inventoryLoading: boolean;
  activeTab: 'shop' | 'inventory';
  onTabChange: (tab: 'shop' | 'inventory') => void;
  onBuyReward: (reward: Reward) => Promise<void>;
}

const getRewardIcon = (icon: string): React.ReactNode => {
  const cls = 'w-[18px] h-[18px] shrink-0 text-carbon-muted';
  switch (icon) {
    case 'coffee':
      return <Coffee className={cls} strokeWidth={2.2} aria-hidden="true" />;
    case 'discount':
      return <Percent className={cls} strokeWidth={2.2} aria-hidden="true" />;
    case 'dessert':
      return <Cookie className={cls} strokeWidth={2.2} aria-hidden="true" />;
    case 'game':
      return <Gamepad2 className={cls} strokeWidth={2.2} aria-hidden="true" />;
    default:
      return <Coffee className={cls} strokeWidth={2.2} aria-hidden="true" />;
  }
};

const ICON_LABELS: Record<string, string> = {
  coffee: 'Kahve',
  discount: 'İndirim',
  dessert: 'Tatlı',
  game: 'Oyun',
};

export const RewardSection: React.FC<RewardSectionProps> = ({
  currentUser,
  rewards,
  rewardsLoading,
  inventory,
  inventoryLoading,
  activeTab,
  onTabChange,
  onBuyReward,
}) => {
  const canAfford = (cost: number): boolean => (currentUser?.points ?? 0) >= cost;

  // Track which coupon is currently being "shown to the cashier" via the
  // CouponDetailModal — null when no modal is open.
  const [selectedCoupon, setSelectedCoupon] = useState<RedeemedReward | null>(null);

  const tabClass = (active: boolean) =>
    `riso-focus min-h-11 font-riso-body text-[15px] font-semibold transition-colors ${
      active ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]' : 'text-carbon-muted hover:text-carbon'
    }`;

  return (
    <div>
      {/* Tab + balance header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="duo-reward-tabs flex gap-6" role="group" aria-label="Ödüller">
          <button
            type="button"
            onClick={() => onTabChange('shop')}
            data-testid="shop-tab"
            aria-pressed={activeTab === 'shop'}
            className={tabClass(activeTab === 'shop')}
          >
            Mağaza
          </button>
          <button
            type="button"
            onClick={() => onTabChange('inventory')}
            data-testid="inventory-tab"
            aria-pressed={activeTab === 'inventory'}
            className={tabClass(activeTab === 'inventory')}
          >
            Envanter ({inventory?.length ?? 0})
          </button>
        </div>

        <p className="inline-flex min-h-11 items-center gap-2 bg-riso-spring px-3 text-carbon">
          <span className="text-[13px] font-medium">Bakiye:</span>
          <span className="text-[15px] font-semibold [font-variant-numeric:tabular-nums]">
            {currentUser?.points ?? 0} puan
          </span>
        </p>
      </div>

      {/* SHOP TAB */}
      {activeTab === 'shop' && (
        <div>
          {rewardsLoading ? (
            <SkeletonGrid count={3} columns={1} />
          ) : (rewards?.length ?? 0) > 0 ? (
            <ul className="space-y-2">
              {rewards.map((reward) => {
                const affordable = canAfford(reward.cost);
                const missing = reward.cost - (currentUser?.points ?? 0);

                return (
                  <li key={reward.id} className="bg-paper-deep p-4">
                    <div className="duo-leader-row !py-0">
                      <h4 className="flex min-w-0 items-center gap-2 font-riso-body text-[15px] font-semibold text-carbon">
                        {getRewardIcon(reward.icon)}
                        <span className="break-words">{reward.title}</span>
                      </h4>
                      <span className="duo-leader-dots" aria-hidden="true" />
                      <span className="duo-leader-value text-[15px] text-carbon">
                        <span>{reward.cost}</span> <span className="text-[13px] font-medium">puan</span>
                      </span>
                    </div>
                    {reward.description && (
                      <p className="mt-1 font-riso-body text-[13px] leading-5 text-carbon-soft break-words">
                        {reward.description}
                      </p>
                    )}
                    <div className="mt-3">
                      <Button
                        tone={affordable ? 'pink' : 'paper'}
                        size="sm"
                        block
                        disabled={!affordable}
                        onClick={() => void onBuyReward(reward)}
                        data-testid="shop-buy-button"
                        leadingIcon={
                          affordable ? <ShoppingBag size={16} strokeWidth={2.4} /> : undefined
                        }
                      >
                        {affordable ? 'Satın al' : `Yetersiz puan · ${missing} eksik`}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={Gift}
              title="Mağaza Boş"
              description="Şu anda satın alınabilecek ödül bulunmuyor. Daha sonra tekrar kontrol edin."
              variant="compact"
            />
          )}
        </div>
      )}

      {/* INVENTORY TAB */}
      {activeTab === 'inventory' && (
        <div>
          {inventoryLoading ? (
            <SkeletonGrid count={4} columns={2} />
          ) : (inventory?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {inventory.map((item) => {
                const expirationDate = new Date(
                  new Date(item.redeemedAt).getTime() + 5 * 24 * 60 * 60 * 1000
                );
                const isExpired = new Date() > expirationDate;
                const isUsed = item.isUsed;
                const dead = isUsed || isExpired;
                const typeLabel = ICON_LABELS[item.icon] || 'Kupon';

                return (
                  <motion.div
                    key={item.redeemId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`relative ${dead ? 'opacity-60' : ''}`}
                    data-testid={`inventory-coupon-${item.redeemId}`}
                  >
                    {/* Ticket — paper with a fıstık edge: header → meta → tear line → QR → code → action */}
                    <div className="relative flex flex-col bg-paper-deep">
                      <span aria-hidden="true" className="block h-2 bg-riso-spring" />
                      {/* Stamp overlay (used wins over expired) */}
                      {isUsed && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                          <div className="bg-carbon px-4 py-2 font-riso-body text-base font-semibold text-paper">
                            Kullanıldı
                          </div>
                        </div>
                      )}
                      {isExpired && !isUsed && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                          <div className="bg-carbon px-4 py-2 font-riso-body text-base font-semibold text-paper">
                            Süresi doldu
                          </div>
                        </div>
                      )}

                      {/* Header — title + type chip + expiry date */}
                      <div className="px-4 pt-4 pb-3">
                        <h4 className="mb-2 break-words font-riso-body text-[15px] font-semibold leading-tight text-carbon">
                          {item.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center bg-riso-spring px-2 py-0.5 text-[13px] font-medium text-carbon">
                            {typeLabel}
                          </span>
                          <span className="text-[13px] text-carbon-soft [font-variant-numeric:tabular-nums]">
                            SKT: {expirationDate.toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>

                      <hr className="duo-tear mx-4" />

                      {/* QR + code stacked vertically — readable on small screens */}
                      <div className="flex flex-col items-center gap-2.5 px-4 pt-3 pb-3">
                        <div className="bg-paper p-2">
                          <QRCodeSVG
                            value={item.code}
                            size={88}
                            bgColor="#FFFFFF"
                            fgColor="#17140F"
                            level="M"
                            includeMargin={false}
                            aria-label={`Kupon kodu: ${item.code}`}
                          />
                        </div>
                        <code className="block w-full break-all px-1 text-center font-riso-mono text-[13px] font-semibold text-carbon">
                          {item.code}
                        </code>
                      </div>

                      {/* Action button — opens detail modal with big QR */}
                      <button
                        type="button"
                        onClick={() => setSelectedCoupon(item)}
                        disabled={dead}
                        data-testid={`coupon-show-${item.redeemId}`}
                        className="riso-focus group mt-auto flex min-h-12 items-center justify-center gap-2 bg-riso-pink px-3 font-riso-body text-[15px] font-semibold text-carbon transition-transform active:scale-[0.98] disabled:cursor-not-allowed"
                      >
                        Kasada göster
                        <ArrowRight
                          size={16}
                          aria-hidden="true"
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="Envanterin Boş"
              description="Henüz hiç kuponun yok. Mağazadan puanlarınla ödül satın alabilirsin!"
              action={{
                label: 'Mağazaya Git',
                onClick: () => onTabChange('shop'),
              }}
              variant="compact"
            />
          )}
        </div>
      )}

      <CouponDetailModal
        isOpen={selectedCoupon !== null}
        coupon={selectedCoupon}
        onClose={() => setSelectedCoupon(null)}
      />
    </div>
  );
};

export default RewardSection;
