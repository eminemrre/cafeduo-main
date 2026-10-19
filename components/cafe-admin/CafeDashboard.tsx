import React, { useCallback, useMemo } from 'react';
import { Trophy, Gift, MapPin, QrCode } from 'lucide-react';
import type { User } from '../../types';
import { useCafeAdmin } from '../../hooks/useCafeAdmin';
import { useToast } from '../../contexts/ToastContext';
import { CafeStats } from './CafeStats';
import { CouponScanner } from './CouponScanner';
import { RewardManager } from './RewardManager';
import { TournamentManager } from './TournamentManager';
import { LocationManager } from './LocationManager';
import type { CafeAdminTab } from './types';

interface CafeDashboardProps {
  currentUser: User;
}

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const CafeDashboard: React.FC<CafeDashboardProps> = ({ currentUser }) => {
  const toast = useToast();
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
    tournaments,
    tournamentsLoading,
    tournamentsError,
    tournamentForm,
    setTournamentForm,
    createTournament,
    cancelTournament,
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
      toast.success('Ödül başarıyla oluşturuldu!');
    } catch (error: unknown) {
      toast.error(toErrorMessage(error, 'Ödül oluşturulurken hata oluştu.'));
    }
  }, [createReward, toast]);

  const handleDeleteReward = useCallback(
    async (id: number | string) => {
      try {
        await deleteReward(id);
      } catch (error: unknown) {
        toast.error(toErrorMessage(error, 'Silme işlemi başarısız.'));
      }
    },
    [deleteReward, toast]
  );

  const tabItems: Array<{
    id: CafeAdminTab;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = [
    {
      id: 'verification',
      label: 'Kupon İşlemleri',
      icon: QrCode,
    },
    {
      id: 'rewards',
      label: 'Ödül Yönetimi',
      icon: Gift,
    },
    {
      id: 'tournaments',
      label: 'Turnuvalar',
      icon: Trophy,
    },
    {
      id: 'settings',
      label: 'Konum Ayarları',
      icon: MapPin,
    },
  ];

  return (
    <div className="min-h-screen bg-paper text-carbon pt-32 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] relative overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 min-w-0">
          <h1 className="font-candy-display text-[2rem] sm:text-[2.5rem] leading-[0.98] text-carbon break-words">
            Kafe Yönetim Paneli
          </h1>
          <p className="mt-2 text-[0.9375rem] text-carbon-soft font-candy-body">
            Kuponları okut, ödülleri ve turnuvaları düzenle, kafenin konumunu ayarla.
          </p>
        </header>

        <CafeStats stats={stats} />

        <div
          className="flex gap-6 mb-8 overflow-x-auto"
          role="tablist"
          aria-label="Kafe yönetim sekmeleri"
        >
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
                className={`duo-focus min-h-12 px-0.5 font-semibold text-[0.9375rem] whitespace-nowrap transition-[color,box-shadow] flex items-center gap-2 font-candy-body ${
                  isActive
                    ? 'text-carbon shadow-[inset_0_-3px_0_#17140f]'
                    : 'text-carbon-muted hover:text-carbon hover:shadow-[inset_0_-3px_0_#17140f40]'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'verification' && (
          <section
            id="cafe-admin-panel-verification"
            role="tabpanel"
            aria-labelledby="cafe-admin-tab-verification"
          >
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
          <section
            id="cafe-admin-panel-rewards"
            role="tabpanel"
            aria-labelledby="cafe-admin-tab-rewards"
          >
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

        {activeTab === 'tournaments' && (
          <section
            id="cafe-admin-panel-tournaments"
            role="tabpanel"
            aria-labelledby="cafe-admin-tab-tournaments"
          >
            <TournamentManager
              rewards={rewards}
              rewardsLoading={rewardsLoading}
              tournaments={tournaments}
              tournamentsLoading={tournamentsLoading}
              tournamentsError={tournamentsError}
              tournamentForm={tournamentForm}
              setTournamentForm={setTournamentForm}
              onCreate={createTournament}
              onCancel={cancelTournament}
            />
          </section>
        )}

        {activeTab === 'settings' && (
          <section
            id="cafe-admin-panel-settings"
            role="tabpanel"
            aria-labelledby="cafe-admin-tab-settings"
          >
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
