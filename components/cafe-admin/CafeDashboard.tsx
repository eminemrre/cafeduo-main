import React, { useCallback, useMemo } from 'react';
import { Coffee, Gift, MapPin, QrCode } from 'lucide-react';
import type { User } from '../../types';
import { useCafeAdmin } from '../../hooks/useCafeAdmin';
import { CafeStats } from './CafeStats';
import { CouponScanner } from './CouponScanner';
import { RewardManager } from './RewardManager';
import { LocationManager } from './LocationManager';
import type { CafeAdminTab } from './types';

interface CafeDashboardProps {
  currentUser: User;
}

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const CafeDashboard: React.FC<CafeDashboardProps> = ({ currentUser }) => {
  const {
    activeTab,
    setActiveTab,
    couponCode,
    setCouponCode,
    couponStatus,
    couponMessage,
    lastItem,
    couponSubmitting,
    rewards,
    rewardsLoading,
    rewardsError,
    rewardForm,
    setRewardForm,
    locationLatitude,
    locationLongitude,
    locationRadius,
    locationSecondaryLatitude,
    locationSecondaryLongitude,
    locationSecondaryRadius,
    setLocationLatitude,
    setLocationLongitude,
    setLocationRadius,
    setLocationSecondaryLatitude,
    setLocationSecondaryLongitude,
    setLocationSecondaryRadius,
    locationStatus,
    locationMessage,
    locationLoading,
    submitCoupon,
    createReward,
    deleteReward,
    updateLocation,
    pickCurrentLocation,
  } = useCafeAdmin({ currentUser });

  const stats = useMemo(
    () => ({
      rewardCount: rewards.length,
      locationSummary:
        locationLatitude && locationLongitude
          ? `${locationLatitude}, ${locationLongitude} (${locationRadius}m)${
              locationSecondaryLatitude && locationSecondaryLongitude
                ? ` + ${locationSecondaryLatitude}, ${locationSecondaryLongitude} (${locationSecondaryRadius}m)`
                : ''
            }`
          : 'Konum tanımlı değil',
      lastCouponCode: lastItem?.code || null,
    }),
    [
      lastItem?.code,
      locationLatitude,
      locationLongitude,
      locationRadius,
      locationSecondaryLatitude,
      locationSecondaryLongitude,
      locationSecondaryRadius,
      rewards.length,
    ]
  );

  const handleCreateReward = useCallback(async () => {
    try {
      await createReward();
      window.alert('Ödül başarıyla oluşturuldu!');
    } catch (error: unknown) {
      window.alert(toErrorMessage(error, 'Ödül oluşturulurken hata oluştu.'));
    }
  }, [createReward]);

  const handleDeleteReward = useCallback(async (id: number | string) => {
    try {
      await deleteReward(id);
    } catch (error: unknown) {
      window.alert(toErrorMessage(error, 'Silme işlemi başarısız.'));
    }
  }, [deleteReward]);

  const tabItems: Array<{
    id: CafeAdminTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    activeClassName: string;
  }> = [
    { id: 'verification', label: 'Kupon İşlemleri', icon: QrCode, activeClassName: 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' },
    { id: 'rewards', label: 'Ödül Yönetimi', icon: Gift, activeClassName: 'bg-orange-600 text-white shadow-lg shadow-orange-900/50' },
    { id: 'settings', label: 'Konum Ayarları', icon: MapPin, activeClassName: 'bg-green-600 text-white shadow-lg shadow-green-900/50' },
  ];

  return (
    <div className="min-h-screen rf-page-shell text-[var(--rf-ink)] pt-24 px-4 pb-[calc(3rem+env(safe-area-inset-bottom))] relative overflow-hidden">
      <div className="absolute inset-0 rf-grid opacity-[0.06] pointer-events-none" />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 bg-cyan-500/15 rounded-2xl border border-cyan-400/30 flex items-center justify-center">
            <Coffee size={32} className="text-cyan-300" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Kafe Yönetim Paneli</h1>
            <p className="text-[var(--rf-muted)]">Kupon doğrulama, ödül ve konum doğrulama yönetimi</p>
          </div>
        </div>

        <CafeStats stats={stats} />

        <div className="flex gap-4 mb-8 flex-wrap" role="tablist" aria-label="Kafe yönetim sekmeleri">
          {tabItems.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`cafe-admin-panel-${tab.id}`}
                id={`cafe-admin-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${
                  isActive
                    ? tab.activeClassName
                    : 'bg-[#0a1630]/70 text-gray-400 hover:bg-[#102447]'
                }`}
              >
                <Icon size={20} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'verification' && (
          <section id="cafe-admin-panel-verification" role="tabpanel" aria-labelledby="cafe-admin-tab-verification">
            <CouponScanner
              couponCode={couponCode}
              onCouponCodeChange={setCouponCode}
              onSubmit={submitCoupon}
              status={couponStatus}
              message={couponMessage}
              submitting={couponSubmitting}
              lastItem={lastItem}
            />
          </section>
        )}

        {activeTab === 'rewards' && (
          <section id="cafe-admin-panel-rewards" role="tabpanel" aria-labelledby="cafe-admin-tab-rewards">
            <RewardManager
              rewards={rewards}
              rewardsLoading={rewardsLoading}
              rewardsError={rewardsError}
              rewardForm={rewardForm}
              onRewardFormChange={setRewardForm}
              onCreateReward={handleCreateReward}
              onDeleteReward={handleDeleteReward}
            />
          </section>
        )}

        {activeTab === 'settings' && (
          <section id="cafe-admin-panel-settings" role="tabpanel" aria-labelledby="cafe-admin-tab-settings">
            <LocationManager
              latitude={locationLatitude}
              longitude={locationLongitude}
              radius={locationRadius}
              secondaryLatitude={locationSecondaryLatitude}
              secondaryLongitude={locationSecondaryLongitude}
              secondaryRadius={locationSecondaryRadius}
              onLatitudeChange={setLocationLatitude}
              onLongitudeChange={setLocationLongitude}
              onRadiusChange={setLocationRadius}
              onSecondaryLatitudeChange={setLocationSecondaryLatitude}
              onSecondaryLongitudeChange={setLocationSecondaryLongitude}
              onSecondaryRadiusChange={setLocationSecondaryRadius}
              onPickCurrentLocation={pickCurrentLocation}
              onSubmit={updateLocation}
              status={locationStatus}
              message={locationMessage}
              loading={locationLoading}
            />
          </section>
        )}
      </div>
    </div>
  );
};

export default CafeDashboard;
