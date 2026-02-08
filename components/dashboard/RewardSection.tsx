/**
 * RewardSection Component
 * 
 * @description Mağaza ve envanter yönetimi
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Reward, RedeemedReward, User } from '../../types';
import { Coffee, Percent, Cookie, Gamepad2, ShoppingBag, Ticket, Package, Gift } from 'lucide-react';
import { RetroButton } from '../RetroButton';
import { SkeletonGrid, SkeletonCard } from '../Skeleton';
import { EmptyState } from '../EmptyState';

interface RewardSectionProps {
  // Kullanıcı
  currentUser: User;
  
  // Mağaza
  rewards: Reward[];
  rewardsLoading: boolean;
  
  // Envanter
  inventory: RedeemedReward[];
  inventoryLoading: boolean;
  
  // Tab state
  activeTab: 'shop' | 'inventory';
  onTabChange: (tab: 'shop' | 'inventory') => void;
  
  // İşlemler
  onBuyReward: (reward: Reward) => Promise<void>;
}

// Ödül ikonları
const getRewardIcon = (icon: string) => {
  const iconClass = "w-6 h-6";
  switch (icon) {
    case 'coffee': return <Coffee className={iconClass} />;
    case 'discount': return <Percent className={iconClass} />;
    case 'dessert': return <Cookie className={iconClass} />;
    case 'game': return <Gamepad2 className={iconClass} />;
    default: return <Coffee className={iconClass} />;
  }
};

export const RewardSection: React.FC<RewardSectionProps> = ({
  currentUser,
  rewards,
  rewardsLoading,
  inventory,
  inventoryLoading,
  activeTab,
  onTabChange,
  onBuyReward
}) => {
  const canAfford = (cost: number) => (currentUser?.points ?? 0) >= cost;

  return (
    <div className="rf-panel border-cyan-400/20 rounded-xl p-4 sm:p-6">
      {/* Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 bg-[#08152f] p-1 rounded-lg border border-cyan-400/20 self-start">
          <button
            onClick={() => onTabChange('shop')}
            data-testid="shop-tab"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'shop'
                ? 'bg-[#0e355f] text-cyan-50 border border-cyan-300/35'
                : 'text-[var(--rf-muted)] hover:text-white'
            }`}
          >
            Mağaza
          </button>
          <button
            onClick={() => onTabChange('inventory')}
            data-testid="inventory-tab"
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'inventory'
                ? 'bg-[#0e355f] text-cyan-50 border border-cyan-300/35'
                : 'text-[var(--rf-muted)] hover:text-white'
            }`}
          >
            Envanter ({inventory?.length ?? 0})
          </button>
        </div>
        
        <div className="text-left sm:text-right">
          <span className="text-[var(--rf-muted)] text-sm">Bakiye:</span>
          <span className="text-amber-300 font-bold text-xl ml-2">
            {(currentUser?.points ?? 0)} puan
          </span>
        </div>
      </div>

      {/* Mağaza Tab */}
      {activeTab === 'shop' && (
        <div>
          {rewardsLoading ? (
            <SkeletonGrid count={3} columns={1} />
          ) : (rewards?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2 gap-4">
              {rewards.map((reward) => {
                const affordable = canAfford(reward.cost);
                
                return (
                  <motion.div
                    key={reward.id}
                    className={`relative group bg-[#0b1834]/82 border rounded-xl p-4 sm:p-5 flex flex-col justify-between min-h-[220px] cursor-pointer ${
                      affordable
                        ? 'border-cyan-300/30'
                        : 'border-slate-500/35 opacity-60'
                    }`}
                    whileHover={affordable ? { 
                      y: -6, 
                      boxShadow: '0 16px 34px rgba(0, 0, 0, 0.35)',
                      borderColor: 'rgba(10, 215, 255, 0.4)'
                    } : {}}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className={`p-2 rounded-lg ${
                          affordable ? 'bg-cyan-400/18 text-cyan-300' : 'bg-slate-700/45 text-slate-400'
                        }`}>
                          {getRewardIcon(reward.icon)}
                        </div>
                        <span className={`font-bold text-xl ${
                          affordable ? 'text-white' : 'text-slate-300'
                        }`}>
                          {reward.cost}
                        </span>
                      </div>
                      
                      <h4 className="text-base sm:text-lg font-bold text-white mb-1 break-words">
                        {reward.title}
                      </h4>
                      <p className="text-xs text-[var(--rf-muted)] mb-4 break-words">
                        {reward.description}
                      </p>
                    </div>

                    <motion.div
                      whileHover={affordable ? { scale: 1.02 } : {}}
                      whileTap={affordable ? { scale: 0.98 } : {}}
                    >
                      <RetroButton
                        onClick={() => onBuyReward(reward)}
                        disabled={!affordable}
                        variant={affordable ? 'primary' : 'secondary'}
                        data-testid="shop-buy-button"
                        className="w-full text-sm"
                      >
                        {affordable ? (
                          <><ShoppingBag size={16} /> Satın Al</>
                        ) : (
                          'Yetersiz Puan'
                        )}
                      </RetroButton>
                    </motion.div>
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

      {/* Envanter Tab */}
      {activeTab === 'inventory' && (
        <div>
          {inventoryLoading ? (
            <SkeletonGrid count={4} columns={1} />
          ) : (inventory?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventory.map((item) => {
                const expirationDate = new Date(
                  new Date(item.redeemedAt).getTime() + 5 * 24 * 60 * 60 * 1000
                );
                const isExpired = new Date() > expirationDate;
                const isUsed = item.isUsed;

                return (
                  <motion.div
                    key={item.redeemId}
                    className={`relative overflow-hidden font-mono shadow-lg ${
                      isUsed || isExpired ? 'grayscale opacity-70' : ''
                    }`}
                    whileHover={!isUsed && !isExpired ? {
                      rotate: [0, -1, 1, 0],
                      transition: { duration: 0.3 }
                    } : {}}
                    whileTap={!isUsed && !isExpired ? { scale: 0.98 } : {}}
                  >
                    <div className="bg-[#fff8dc] text-black p-4 rounded h-full flex flex-col justify-between">
                      {/* Delikler */}
                      <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#08152f] rounded-full" />
                      <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#08152f] rounded-full" />

                      <div className="border-2 border-black border-dashed p-3 h-full flex flex-col justify-between relative">
                        {isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="bg-red-600 text-white font-bold text-lg px-4 py-2 rotate-[-15deg] border-4 border-white shadow-xl">
                              KULLANILDI
                            </div>
                          </div>
                        )}
                        {isExpired && !isUsed && (
                          <div className="absolute inset-0 flex items-center justify-center z-10">
                            <div className="bg-gray-600 text-white font-bold text-lg px-4 py-2 rotate-[-15deg] border-4 border-white shadow-xl">
                              SÜRESİ DOLDU
                            </div>
                          </div>
                        )}

                        <div className="text-center border-b-2 border-black pb-2 mb-2">
                          <h4 className="font-bold text-lg uppercase">{item.title}</h4>
                          <span className="text-xs">CAFE DUO KUPONU</span>
                        </div>

                        <div className="flex justify-between items-center mb-2">
                          <div className="w-16 h-16 bg-black text-white flex items-center justify-center text-[8px] p-1 text-center">
                            QR KOD
                          </div>
                          <div className="text-right">
                            <span className="block text-xl font-bold tracking-widest">
                              {item.code}
                            </span>
                            <span className="text-[10px] block">
                              SKT: {expirationDate.toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="bg-black text-white text-center py-1 text-xs font-bold uppercase">
                          KASADA GÖSTERİN
                        </div>
                      </div>
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
                label: "Mağazaya Git",
                onClick: () => onTabChange('shop')
              }}
              variant="compact"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default RewardSection;
