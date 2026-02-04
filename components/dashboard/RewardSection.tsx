/**
 * RewardSection Component
 * 
 * @description Mağaza ve envanter yönetimi
 */

import React from 'react';
import { Reward, RedeemedReward, User } from '../../types';
import { Coffee, Percent, Cookie, Gamepad2, ShoppingBag, Ticket } from 'lucide-react';
import { RetroButton } from '../RetroButton';
import { SkeletonGrid, SkeletonCard } from '../Skeleton';

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
  const canAfford = (cost: number) => currentUser.points >= cost;

  return (
    <div className="bg-[#151921] border border-gray-800 rounded-xl p-6">
      {/* Tab Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-[#0f141a] p-1 rounded-lg">
          <button
            onClick={() => onTabChange('shop')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'shop'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Mağaza
          </button>
          <button
            onClick={() => onTabChange('inventory')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'inventory'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Envanter ({inventory.length})
          </button>
        </div>
        
        <div className="text-right">
          <span className="text-gray-400 text-sm">Bakiye:</span>
          <span className="text-yellow-500 font-bold text-xl ml-2">
            {currentUser.points} puan
          </span>
        </div>
      </div>

      {/* Mağaza Tab */}
      {activeTab === 'shop' && (
        <div>
          {rewardsLoading ? (
            <SkeletonGrid count={3} columns={1} />
          ) : rewards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((reward) => {
                const affordable = canAfford(reward.cost);
                
                return (
                  <div
                    key={reward.id}
                    className={`relative group bg-[#1a1f2e] border-2 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 h-full ${
                      affordable
                        ? 'border-yellow-500/30 hover:border-yellow-500'
                        : 'border-gray-700 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className={`p-2 rounded-lg ${
                          affordable ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700/50 text-gray-500'
                        }`}>
                          {getRewardIcon(reward.icon)}
                        </div>
                        <span className={`font-bold text-xl ${
                          affordable ? 'text-white' : 'text-red-400'
                        }`}>
                          {reward.cost}
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-bold text-white mb-1">
                        {reward.title}
                      </h4>
                      <p className="text-xs text-gray-400 mb-4">
                        {reward.description}
                      </p>
                    </div>

                    <RetroButton
                      onClick={() => onBuyReward(reward)}
                      disabled={!affordable}
                      variant={affordable ? 'primary' : 'secondary'}
                      className="w-full text-sm"
                    >
                      {affordable ? (
                        <><ShoppingBag size={16} /> Satın Al</>
                      ) : (
                        'Yetersiz Puan'
                      )}
                    </RetroButton>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
              <p>Henüz ödül bulunmuyor.</p>
            </div>
          )}
        </div>
      )}

      {/* Envanter Tab */}
      {activeTab === 'inventory' && (
        <div>
          {inventoryLoading ? (
            <SkeletonGrid count={4} columns={1} />
          ) : inventory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventory.map((item) => {
                const expirationDate = new Date(
                  new Date(item.redeemedAt).getTime() + 5 * 24 * 60 * 60 * 1000
                );
                const isExpired = new Date() > expirationDate;
                const isUsed = item.isUsed;

                return (
                  <div
                    key={item.redeemId}
                    className={`relative overflow-hidden font-mono shadow-lg ${
                      isUsed || isExpired ? 'grayscale opacity-70' : ''
                    }`}
                  >
                    <div className="bg-[#fff8dc] text-black p-4 rounded h-full flex flex-col justify-between">
                      {/* Delikler */}
                      <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#151921] rounded-full" />
                      <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#151921] rounded-full" />

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
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Ticket size={48} className="mx-auto mb-4 text-gray-500 opacity-30" />
              <p className="text-gray-500">Henüz kuponun yok.</p>
              <p className="text-gray-500 text-sm mt-2">
                Mağazadan puanlarınla ödül alabilirsin.
              </p>
              <button
                onClick={() => onTabChange('shop')}
                className="mt-4 text-blue-400 hover:underline"
              >
                Mağazaya Git →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RewardSection;
