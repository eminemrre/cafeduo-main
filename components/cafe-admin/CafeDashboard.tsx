import React, { useCallback, useMemo } from 'react';
import { Trophy, Coffee, Gift, MapPin, QrCode } from 'lucide-react';
import type { User } from '../../types';
import { useCafeAdmin } from '../../hooks/useCafeAdmin';
import { useToast } from '../../contexts/ToastContext';
import { toErrorMessage } from '../../lib/errorMessage';
import { CafeStats } from './CafeStats';
import { CouponScanner } from './CouponScanner';
import { RewardManager } from './RewardManager';
import { TournamentManager } from './TournamentManager';
import { LocationManager } from './LocationManager';
import type { CafeAdminTab } from './types';

interface CafeDashboardProps {
  currentUser: User;
}

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
    activeClassName: string;
  }> = [
    {
      id: 'verification',
      label: 'Kupon İşlemleri',
      icon: QrCode,
      activeClassName: 'bg-riso-blue text-paper border-carbon riso-shadow-sm',
    },
    {
      id: 'rewards',
      label: 'Ödül Yönetimi',
      icon: Gift,
      activeClassName: 'bg-riso-pink text-carbon border-carbon riso-shadow-sm',
    },
    {
      id: 'tournaments',
      label: 'Turnuvalar',
      icon: Trophy,
      activeClassName: 'bg-riso-mustard text-carbon border-carbon riso-shadow-sm',
    },
    {
      id: 'settings',
      label: 'Konum Ayarları',
      icon: MapPin,
      activeClassName: 'bg-riso-spring text-carbon border-carbon riso-shadow-sm',
    },
  ];

  return (
    <div className="min-h-screen bg-paper text-carbon pt-24 px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] relative overflow-hidden ">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8 border-2 border-carbon bg-paper riso-shadow-md p-5">
          <div className="w-16 h-16 bg-riso-mustard border-2 border-carbon flex items-center justify-center riso-shadow-sm shrink-0">
            <Coffee size={32} className="text-carbon" />
          </div>
          <div className="min-w-0">
            <p className="font-riso-mono text-xs uppercase tracking-[0.18em] text-carbon-soft">
              Cafe Control Net
            </p>
            <h1 className="text-3xl md:text-4xl leading-[1.02] font-riso-display text-carbon tracking-[0.08em] mb-1 break-words uppercase">
              Kafe Yönetim Paneli
            </h1>
            <p className="text-carbon-muted uppercase tracking-[0.12em] text-xs md:text-sm font-riso-body">
              Kupon doğrulama, ödül ve konum doğrulama yönetimi
            </p>
          </div>
        </div>

        <CafeStats stats={stats} />

        <div
          className="flex gap-4 mb-8 flex-wrap"
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
                className={`riso-focus px-6 py-3 border-2 font-bold transition-all flex items-center gap-2 uppercase tracking-[0.1em] font-riso-display ${
                  isActive
                    ? tab.activeClassName
                    : 'bg-paper text-carbon border-carbon hover:bg-paper-deep hover:-translate-y-[1px]'
                }`}
              >
                <Icon size={20} />
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
