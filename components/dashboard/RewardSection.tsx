/**
 * RewardSection — Riso Kantin redesign (PR #26).
 *
 * Shop + Inventory tabs for the dashboard. All data-testid attributes are
 * preserved (`shop-tab`, `inventory-tab`, `shop-buy-button`, plus
 * `skeleton-grid`, `empty-state`, `empty-state-action` from the mocked
 * subcomponents). Tab "active" indicator class is `bg-riso-pink` (updated
 * from the legacy `bg-[#0e355f]` — test file follows the same rename).
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
  const cls = 'w-5 h-5';
  switch (icon) {
    case 'coffee':
      return <Coffee className={cls} strokeWidth={2.4} />;
    case 'discount':
      return <Percent className={cls} strokeWidth={2.4} />;
    case 'dessert':
      return <Cookie className={cls} strokeWidth={2.4} />;
    case 'game':
      return <Gamepad2 className={cls} strokeWidth={2.4} />;
    default:
      return <Coffee className={cls} strokeWidth={2.4} />;
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

  return (
    <div className="duo-card border border-carbon/20 bg-paper p-4 sm:p-6">
      {/* Tab + balance header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="duo-reward-tabs flex self-start">
          <button
            type="button"
            onClick={() => onTabChange('shop')}
            data-testid="shop-tab"
            className={`riso-focus px-4 py-2 font-riso-body text-sm font-bold tracking-wide transition-colors ${
              activeTab === 'shop'
                ? 'bg-riso-pink text-carbon'
                : 'bg-paper text-carbon hover:bg-paper-deep'
            }`}
          >
            Mağaza
          </button>
          <button
            type="button"
            onClick={() => onTabChange('inventory')}
            data-testid="inventory-tab"
            className={`riso-focus border-l-2 border-carbon px-4 py-2 font-riso-body text-sm font-bold tracking-wide transition-colors ${
              activeTab === 'inventory'
                ? 'bg-riso-pink text-carbon'
                : 'bg-paper text-carbon hover:bg-paper-deep'
            }`}
          >
            Envanter ({inventory?.length ?? 0})
          </button>
        </div>

        <div className="inline-flex items-baseline gap-2 border-2 border-carbon bg-riso-mustard px-3 py-1.5 self-start sm:self-auto">
          <span className="font-riso-mono text-[0.7rem] font-bold uppercase tracking-wider text-carbon">
            Bakiye:
          </span>
          <span className="font-riso-display text-lg text-carbon">
            {currentUser?.points ?? 0} puan
          </span>
        </div>
      </div>

      {/* SHOP TAB */}
      {activeTab === 'shop' && (
        <div>
          {rewardsLoading ? (
            <SkeletonGrid count={3} columns={1} />
          ) : (rewards?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {rewards.map((reward, idx) => {
                const affordable = canAfford(reward.cost);
                const rotate = idx % 2 === 0 ? -0.8 : 0.8;

                return (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    style={{ transform: `rotate(${rotate}deg)` }}
                  >
                    <div
                      className={`duo-card relative flex min-h-[200px] flex-col justify-between border border-carbon/20 p-4 sm:p-5 transition-colors ${
                        affordable ? 'bg-paper riso-shadow-sm' : 'bg-paper-deep opacity-65'
                      }`}
                    >
                      <div>
                        <div className="mb-3 flex items-start justify-between">
                          <div
                            className={`flex h-10 w-10 items-center justify-center border-2 border-carbon ${
                              affordable
                                ? 'bg-riso-blue text-paper'
                                : 'bg-paper-dim text-carbon-muted'
                            }`}
                          >
                            {getRewardIcon(reward.icon)}
                          </div>
                          <div className="text-right">
                            <p className="font-riso-mono text-[0.65rem] uppercase tracking-wider text-carbon-muted">
                              Fiyat
                            </p>
                            <span className="font-riso-display text-xl text-carbon">
                              {reward.cost}
                            </span>
                          </div>
                        </div>

                        <h4 className="font-riso-display text-lg text-carbon break-words">
                          {reward.title}
                        </h4>
                        <p className="mt-1 font-riso-body text-xs leading-5 text-carbon-soft break-words">
                          {reward.description}
                        </p>
                      </div>

                      <div className="mt-4">
                        <Button
                          tone={affordable ? 'pink' : 'paper'}
                          size="md"
                          block
                          disabled={!affordable}
                          onClick={() => void onBuyReward(reward)}
                          data-testid="shop-buy-button"
                          leadingIcon={
                            affordable ? <ShoppingBag size={16} strokeWidth={2.5} /> : undefined
                          }
                        >
                          {affordable ? 'Satın Al' : 'Yetersiz Puan'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    className={`relative ${dead ? 'opacity-60 grayscale-[40%]' : ''}`}
                    data-testid={`inventory-coupon-${item.redeemId}`}
                  >
                    {/* Ticket — vertical hierarchy: header → meta → perforation → QR → code → action */}
                    <div className="relative bg-riso-mustard/20 border-2 border-carbon riso-shadow-sm flex flex-col">
                      {/* Stamp overlay (used wins over expired) */}
                      {isUsed && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                          <div className="rotate-[-12deg] border-4 border-riso-redox bg-paper px-4 py-2 font-riso-display text-lg font-bold tracking-wider text-riso-redox">
                            KULLANILDI
                          </div>
                        </div>
                      )}
                      {isExpired && !isUsed && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                          <div className="rotate-[-12deg] border-4 border-carbon bg-paper-deep px-4 py-2 font-riso-display text-lg font-bold tracking-wider text-carbon">
                            SÜRESİ DOLDU
                          </div>
                        </div>
                      )}

                      {/* Header — title + type chip + expiry date */}
                      <div className="px-4 pt-4 pb-3">
                        <h4 className="font-riso-display text-base sm:text-lg text-carbon uppercase tracking-[0.04em] leading-tight mb-2 break-words">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 border-2 border-carbon bg-riso-pink/30 px-2 py-0.5 font-riso-mono text-[0.65rem] font-bold uppercase tracking-wider text-carbon">
                            {typeLabel}
                          </span>
                          <span className="font-riso-mono text-[0.65rem] uppercase tracking-wider text-carbon-soft">
                            SKT: {expirationDate.toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>

                      {/* Perforation — ink dashed divider with paper notches on each end */}
                      <div className="relative">
                        <span
                          aria-hidden="true"
                          className="absolute -left-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-paper border-2 border-carbon"
                        />
                        <span
                          aria-hidden="true"
                          className="absolute -right-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-paper border-2 border-carbon"
                        />
                        <div className="border-t-2 border-dashed border-carbon mx-2" />
                      </div>

                      {/* QR + code stacked vertically — readable on small screens */}
                      <div className="px-4 pt-3 pb-3 flex flex-col items-center gap-2.5">
                        <div className="p-2 border-2 border-carbon bg-paper">
                          <QRCodeSVG
                            value={item.code}
                            size={88}
                            bgColor="#FBF7EE"
                            fgColor="#141413"
                            level="M"
                            includeMargin={false}
                            aria-label={`Kupon kodu: ${item.code}`}
                          />
                        </div>
                        <code className="block w-full text-center font-riso-mono text-[0.7rem] sm:text-xs font-bold tracking-wider text-carbon break-all px-1">
                          {item.code}
                        </code>
                      </div>

                      {/* Action button — opens detail modal with big QR */}
                      <button
                        type="button"
                        onClick={() => setSelectedCoupon(item)}
                        disabled={dead}
                        data-testid={`coupon-show-${item.redeemId}`}
                        className="riso-focus riso-press group mt-auto flex items-center justify-center gap-2 border-t-2 border-carbon bg-riso-pink text-carbon px-3 py-2.5 font-riso-display text-xs font-bold uppercase tracking-[0.14em] transition-all hover:bg-riso-pink-deep hover:text-paper disabled:cursor-not-allowed disabled:hover:bg-riso-pink disabled:hover:text-carbon"
                      >
                        Kasada Göster
                        <ArrowRight
                          size={14}
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
