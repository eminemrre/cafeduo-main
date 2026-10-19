import React from 'react';
import { Gift, MapPin, QrCode } from 'lucide-react';
import type { CafeDashboardStats } from './types';

interface CafeStatsProps {
  stats: CafeDashboardStats;
}

/** Three numbers in ice wells; the reward count sits on fıstık (rewards are fıstık). */
export const CafeStats: React.FC<CafeStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-8">
      <article className="duo-stat duo-stat--fistik">
        <span className="duo-stat-label inline-flex items-center gap-1.5">
          <Gift size={15} aria-hidden="true" /> Ödüller
        </span>
        <span className="duo-stat-value text-[24px] mt-1">{stats.rewardCount}</span>
      </article>
      <article className="duo-stat">
        <span className="duo-stat-label inline-flex items-center gap-1.5">
          <MapPin size={15} aria-hidden="true" /> Konum doğrulama
        </span>
        <span className="duo-stat-value mt-1 text-[15px] font-semibold">{stats.locationSummary}</span>
      </article>
      <article className="duo-stat">
        <span className="duo-stat-label inline-flex items-center gap-1.5">
          <QrCode size={15} aria-hidden="true" /> Son kupon
        </span>
        <span className="duo-stat-value mt-1 text-[15px] font-semibold break-all">
          {stats.lastCouponCode || 'Henüz yok'}
        </span>
      </article>
    </div>
  );
};
