import React from 'react';
import { Gift, MapPin, QrCode } from 'lucide-react';
import type { CafeDashboardStats } from './types';

interface CafeStatsProps {
  stats: CafeDashboardStats;
}

export const CafeStats: React.FC<CafeStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <article className="rf-screen-card-muted p-4">
        <div className="text-[11px] tracking-[0.3em] uppercase text-cyan-300/80 mb-2">Ödüller</div>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-semibold">{stats.rewardCount}</div>
          <Gift size={18} className="text-cyan-300" />
        </div>
      </article>
      <article className="rf-screen-card-muted p-4">
        <div className="text-[11px] tracking-[0.3em] uppercase text-green-300/80 mb-2">Konum Doğrulama</div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{stats.locationSummary}</div>
          <MapPin size={18} className="text-green-300" />
        </div>
      </article>
      <article className="rf-screen-card-muted p-4">
        <div className="text-[11px] tracking-[0.3em] uppercase text-amber-300/80 mb-2">Son Kupon</div>
        <div className="flex items-center justify-between">
          <div className="text-sm font-mono break-all">{stats.lastCouponCode || 'Henüz yok'}</div>
          <QrCode size={18} className="text-amber-300" />
        </div>
      </article>
    </div>
  );
};
